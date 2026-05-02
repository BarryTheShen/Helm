"""
Variable Expression Resolver — resolves {{expression}} syntax in SDUI payloads.

Uses the chevron library (Python mustache) for template rendering. Unresolvable
expressions are preserved as-is (the original {{expression}} text) by pre-scanning
the template, replacing unresolvable tokens with unique placeholders, calling
chevron.render for the resolvable ones, then restoring the originals.

Supported scopes:
  - user.name, user.id, user.email — from the current user object
  - component.<id>.value — from component state dict
  - self.value — shorthand for current component's value
  - custom.<name> — from CustomVariable by user + name
  - env.<key> — from os.environ
  - data.<source_name>.<field> — from data source cache dict
  - connection.<connection_name>.<credential_key> — from Connection credentials
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import chevron
from cryptography.fernet import Fernet
from sqlalchemy import select


logger = logging.getLogger(__name__)

_EXPRESSION_RE = re.compile(r"\{\{(.+?)\}\}")


# ---------------------------------------------------------------------------
# Fernet helpers (unchanged)
# ---------------------------------------------------------------------------

def _get_fernet(encryption_key: str) -> Fernet:
    """Get Fernet cipher using the encryption key."""
    if not encryption_key:
        raise ValueError("ENCRYPTION_KEY must be set in environment variables")
    return Fernet(encryption_key.encode())


def _decrypt_credentials(encrypted: str, encryption_key: str) -> dict:
    """Decrypt encrypted credentials string, return dict."""
    json_str = _get_fernet(encryption_key).decrypt(encrypted.encode()).decode()
    return json.loads(json_str)


# ---------------------------------------------------------------------------
# Scope resolution helpers
# ---------------------------------------------------------------------------

def _resolve_from_context_sync(expr: str, context: dict[str, Any]) -> str | None:
    """Synchronously resolve a single expression (no connection.* scope).

    Returns the resolved string value, or None if unresolvable.
    """
    parts = expr.strip().split(".")
    if not parts:
        return None

    scope = parts[0]

    if scope == "user" and len(parts) == 2:
        user = context.get("user")
        if user is not None:
            value = getattr(user, parts[1], None)
            if value is not None:
                return str(value)

    elif scope == "self" and len(parts) == 2 and parts[1] == "value":
        self_id = context.get("self_id")
        if self_id:
            value = context.get("component_state", {}).get(self_id, {}).get("value")
            if value is not None:
                return str(value)

    elif scope == "component" and len(parts) == 3 and parts[2] == "value":
        value = context.get("component_state", {}).get(parts[1], {}).get("value")
        if value is not None:
            return str(value)

    elif scope == "custom" and len(parts) == 2:
        value = context.get("custom_variables", {}).get(parts[1])
        if value is not None:
            return str(value)

    elif scope == "env" and len(parts) == 2:
        value = os.environ.get(parts[1])
        if value is not None:
            return str(value)

    elif scope == "data" and len(parts) == 3:
        value = context.get("data_cache", {}).get(parts[1], {}).get(parts[2])
        if value is not None:
            return str(value)

    return None


async def _resolve_connection_scope(
    expr: str, context: dict[str, Any]
) -> str | None:
    """Resolve a connection.* expression, querying DB if needed.

    Returns the resolved string value, or None if unresolvable.
    """
    parts = expr.strip().split(".")
    if len(parts) != 3 or parts[0] != "connection":
        return None

    connection_name = parts[1]
    credential_key = parts[2]
    logger.debug(f"_resolve_connection_scope() — connection: {connection_name}, key: {credential_key}")

    connections_cache = context.get("connections_cache", {})
    if connection_name in connections_cache:
        value = connections_cache[connection_name].get(credential_key)
        result = str(value) if value is not None else None
        logger.debug(f"_resolve_connection_scope() — from cache: {result}")
        return result

    db = context.get("db")
    user_id = context.get("user_id")
    encryption_key = context.get("encryption_key")

    if db is not None and user_id is not None and encryption_key is not None:
        from app.models.connection import Connection  # noqa: PLC0415

        result = await db.execute(
            select(Connection).where(
                Connection.user_id == user_id,
                Connection.name == connection_name,
            )
        )
        connection = result.scalar_one_or_none()
        if connection is not None:
            try:
                credentials = _decrypt_credentials(connection.credentials_encrypted, encryption_key)
                connections_cache[connection_name] = credentials
                value = credentials.get(credential_key)
                logger.debug(f"_resolve_connection_scope() — from DB: {connection_name}.{credential_key} = {repr(value)}")
                return str(value) if value is not None else None
            except Exception as exc:
                logger.warning(f"_resolve_connection_scope() — failed to decrypt {connection_name}: {exc}")
                pass

    logger.debug(f"_resolve_connection_scope() — unresolved: {connection_name}.{credential_key}")
    return None


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------

async def resolve_expression(expr: str, context: dict[str, Any]) -> str:
    """Resolve all {{...}} expressions within a string using chevron (mustache).

    Unresolvable expressions are preserved as the original {{expression}} text.

    Strategy:
      1. Find all {{expr}} tokens in the template.
      2. Resolve each one (async for connection.*, sync for others).
      3. Build a flat chevron view: resolved tokens map to their values;
         unresolved tokens are replaced with unique placeholders that chevron
         passes through unchanged, then restored to {{expr}} after rendering.

    Args:
        expr: A string potentially containing {{...}} expressions.
        context: Dict with keys: user, component_state, self_id,
                 custom_variables, data_cache, connections_cache,
                 db, user_id, encryption_key.

    Returns:
        The string with all resolvable expressions replaced.
    """
    if "{{" not in expr:
        return expr

    tokens = list(dict.fromkeys(m.group(1) for m in _EXPRESSION_RE.finditer(expr)))
    logger.debug(f"resolve_expression() — expr: {repr(expr[:100])}, tokens: {tokens}")

    # Resolve each token
    resolved: dict[str, str] = {}
    unresolved: list[str] = []
    for token in tokens:
        raw = token.strip()
        if raw.startswith("connection."):
            value = await _resolve_connection_scope(raw, context)
        else:
            value = _resolve_from_context_sync(raw, context)

        if value is not None:
            resolved[token] = value
            logger.debug(f"resolve_expression() — resolved {token} → {repr(value)}")
        else:
            unresolved.append(token)

    if unresolved:
        logger.debug(f"resolve_expression() — unresolved tokens: {unresolved}")

    # Build a working template where ALL tokens use triple-mustache ({{{...}}})
    # to disable HTML escaping — SDUI values are plain text, not HTML.
    # Unresolved tokens get placeholder keys; resolved tokens keep their path.
    unresolved_map: dict[str, str] = {}  # placeholder → original {{token}}
    working = expr
    for i, token in enumerate(tokens):
        if token not in resolved:
            placeholder = f"__HELM_UNRESOLVED_{i}__"
            unresolved_map[placeholder] = "{{" + token + "}}"
            working = working.replace("{{" + token + "}}", "{{{" + placeholder + "}}}")
            logger.debug(f"[VariableResolver] resolve_expression() — created placeholder {placeholder} for unresolved {{{{token}}}}")
        else:
            # Replace {{token}} with {{{token}}} to skip HTML escaping
            working = working.replace("{{" + token + "}}", "{{{" + token + "}}}")

    # Build chevron view: resolved tokens use dot-path keys (chevron walks them),
    # placeholder keys are flat strings that chevron looks up directly.
    # We use a flat view with dot-path strings as keys — chevron resolves
    # {{a.b}} by walking nested dicts, so we need a nested view for resolved
    # tokens and a flat view for placeholders.
    #
    # Simplest approach: build a nested dict for resolved paths + flat entries
    # for placeholders, then merge into one view dict.
    view: dict[str, Any] = {}

    # Add placeholder pass-throughs (flat keys, no dots)
    for placeholder, original in unresolved_map.items():
        view[placeholder] = original

    # Add resolved values as nested dicts
    for token, value in resolved.items():
        parts = token.strip().split(".")
        node = view
        for part in parts[:-1]:
            if part not in node or not isinstance(node[part], dict):
                node[part] = {}
            node = node[part]
        node[parts[-1]] = value

    rendered = chevron.render(working, view)
    logger.debug(f"[VariableResolver] resolve_expression() — rendered result: {repr(rendered[:100])}")

    # Restore any placeholders that chevron may have left (shouldn't happen,
    # but defensive in case chevron skips unknown keys).
    for placeholder, original in unresolved_map.items():
        if placeholder in rendered:
            logger.debug(f"[VariableResolver] resolve_expression() — restoring placeholder {placeholder} → {original}")
        rendered = rendered.replace(placeholder, original)

    return rendered


async def resolve_all_expressions(payload: Any, context: dict[str, Any]) -> Any:
    """Recursively walk a dict/list and resolve all {{...}} in string values.

    Args:
        payload: A dict, list, or scalar value.
        context: Resolution context dict.

    Returns:
        A new structure with all string expressions resolved.
    """
    if isinstance(payload, dict):
        result = {k: await resolve_all_expressions(v, context) for k, v in payload.items()}
        logger.debug(f"[VariableResolver] resolve_all_expressions() — dict with {len(payload)} keys")
        return result
    elif isinstance(payload, list):
        result = [await resolve_all_expressions(item, context) for item in payload]
        logger.debug(f"[VariableResolver] resolve_all_expressions() — list with {len(payload)} items")
        return result
    elif isinstance(payload, str):
        result = await resolve_expression(payload, context)
        logger.debug(f"[VariableResolver] resolve_all_expressions() — string value processed")
        return result
    return payload
