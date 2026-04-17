"""
Variable Expression Resolver — resolves {{expression}} syntax in SDUI payloads.

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

import base64
import hashlib
import json
import os
import re
from typing import Any

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


_EXPRESSION_RE = re.compile(r"\{\{(.+?)\}\}")


def _get_fernet(secret_key: str) -> Fernet:
    """Derive a Fernet key from the app's secret key."""
    key_material = secret_key.encode()
    digest = hashlib.sha256(key_material).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def _decrypt_credentials(encrypted: str, secret_key: str) -> dict:
    """Decrypt encrypted credentials string, return dict."""
    json_str = _get_fernet(secret_key).decrypt(encrypted.encode()).decode()
    return json.loads(json_str)


async def _resolve_single(expr: str, context: dict[str, Any]) -> str:
    """Resolve a single expression (without the {{ }} delimiters)."""
    parts = expr.strip().split(".")

    if not parts:
        return "{{" + expr + "}}"

    scope = parts[0]

    # user.name / user.id / user.email
    if scope == "user" and len(parts) == 2:
        user = context.get("user")
        if user is not None:
            attr = parts[1]
            value = getattr(user, attr, None)
            if value is not None:
                return str(value)

    # self.value — shorthand for current component
    elif scope == "self" and len(parts) == 2 and parts[1] == "value":
        self_id = context.get("self_id")
        if self_id:
            component_state = context.get("component_state", {})
            value = component_state.get(self_id, {}).get("value")
            if value is not None:
                return str(value)

    # component.<id>.value
    elif scope == "component" and len(parts) == 3 and parts[2] == "value":
        component_id = parts[1]
        component_state = context.get("component_state", {})
        value = component_state.get(component_id, {}).get("value")
        if value is not None:
            return str(value)

    # custom.<name>
    elif scope == "custom" and len(parts) == 2:
        name = parts[1]
        custom_variables = context.get("custom_variables", {})
        value = custom_variables.get(name)
        if value is not None:
            return str(value)

    # env.<key>
    elif scope == "env" and len(parts) == 2:
        key = parts[1]
        value = os.environ.get(key)
        if value is not None:
            return str(value)

    # data.<source_name>.<field>
    elif scope == "data" and len(parts) == 3:
        source_name = parts[1]
        field = parts[2]
        data_cache = context.get("data_cache", {})
        source_data = data_cache.get(source_name, {})
        value = source_data.get(field)
        if value is not None:
            return str(value)

    # connection.<connection_name>.<credential_key>
    elif scope == "connection" and len(parts) == 3:
        connection_name = parts[1]
        credential_key = parts[2]

        # Try cache first
        connections_cache = context.get("connections_cache", {})
        if connection_name in connections_cache:
            connection_creds = connections_cache[connection_name]
            value = connection_creds.get(credential_key)
            if value is not None:
                return str(value)

        # Query database if cache miss and db/user_id/secret_key available
        db = context.get("db")
        user_id = context.get("user_id")
        secret_key = context.get("secret_key")

        if db is not None and user_id is not None and secret_key is not None:
            from app.models.connection import Connection

            result = await db.execute(
                select(Connection).where(
                    Connection.user_id == user_id,
                    Connection.name == connection_name,
                )
            )
            connection = result.scalar_one_or_none()

            if connection is not None:
                try:
                    credentials = _decrypt_credentials(connection.credentials_encrypted, secret_key)
                    # Cache for future lookups in this context
                    if connection_name not in connections_cache:
                        connections_cache[connection_name] = credentials
                    value = credentials.get(credential_key)
                    if value is not None:
                        return str(value)
                except Exception:
                    # Decryption failed or other error — return original
                    pass

    # Unresolved — return original text
    return "{{" + expr + "}}"


async def resolve_expression(expr: str, context: dict[str, Any]) -> str:
    """Resolve all {{...}} expressions within a string.

    Args:
        expr: A string potentially containing {{...}} expressions.
        context: Dict with keys: user, component_state, self_id,
                 custom_variables, data_cache, connections_cache, db, secret_key.

    Returns:
        The string with all resolvable expressions replaced.
    """
    async def _replacer(match: re.Match[str]) -> str:
        return await _resolve_single(match.group(1), context)

    # For async replacement, we need to handle matches manually
    result = expr
    for match in reversed(list(_EXPRESSION_RE.finditer(expr))):
        resolved = await _resolve_single(match.group(1), context)
        result = result[:match.start()] + resolved + result[match.end():]
    return result


async def resolve_all_expressions(payload: Any, context: dict[str, Any]) -> Any:
    """Recursively walk a dict/list and resolve all {{...}} in string values.

    Args:
        payload: A dict, list, or scalar value.
        context: Resolution context dict.

    Returns:
        A new structure with all string expressions resolved.
    """
    if isinstance(payload, dict):
        return {k: await resolve_all_expressions(v, context) for k, v in payload.items()}
    elif isinstance(payload, list):
        return [await resolve_all_expressions(item, context) for item in payload]
    elif isinstance(payload, str):
        return await resolve_expression(payload, context)
    return payload
