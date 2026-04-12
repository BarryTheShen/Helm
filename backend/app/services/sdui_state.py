"""Shared SDUI state helpers used by both REST routes and MCP tools."""

from collections.abc import Sequence
from typing import Any
from uuid import uuid4

from sqlalchemy import and_, not_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.module_state import ModuleState
from app.services.websocket_manager import manager

SDUI_MODULE_PREFIX = "sdui__"
LEGACY_CONFIG_PREFIX = "config__"


def live_screen_key(module_id: str) -> str:
    """Return the module_states key for a live SDUI screen."""
    return SDUI_MODULE_PREFIX + module_id


def draft_screen_key(module_id: str) -> str:
    """Return the module_states key for a pending SDUI draft."""
    return live_screen_key(module_id) + "__draft"


def legacy_module_config_key(module_id: str) -> str:
    """Return the legacy config key used by existing REST endpoints."""
    return LEGACY_CONFIG_PREFIX + module_id


def sdui_module_config_key(module_id: str) -> str:
    """Return the SDUI-scoped config key used by older stored state."""
    return live_screen_key(module_id) + "__config"


def live_screen_module_type_filter(module_type_column: Any) -> Any:
    """Return a SQL predicate matching only live SDUI screen rows."""
    return and_(
        module_type_column.startswith(SDUI_MODULE_PREFIX),
        not_(module_type_column.endswith("__draft")),
        not_(module_type_column.endswith("__config")),
    )


def module_state_keys_to_clear(module_id: str) -> tuple[str, str, str, str]:
    """Return every module_states key that should be removed for a screen delete."""
    return (
        live_screen_key(module_id),
        draft_screen_key(module_id),
        sdui_module_config_key(module_id),
        legacy_module_config_key(module_id),
    )


async def delete_module_states(
    db: AsyncSession,
    user_id: str,
    module_types: Sequence[str],
) -> set[str]:
    """Delete the requested module state rows and return the deleted keys."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type.in_(list(module_types)),
        )
    )
    states = result.scalars().all()
    deleted_types: set[str] = set()
    for state in states:
        deleted_types.add(state.module_type)
        await db.delete(state)
    return deleted_types


async def persist_live_screen(
    db: AsyncSession,
    user_id: str,
    module_id: str,
    screen: dict[str, Any],
    *,
    clear_existing_draft: bool = True,
) -> tuple[int, bool]:
    """Upsert the live screen row and optionally clear any lingering draft row."""
    cleared_existing_draft = False

    if clear_existing_draft:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == draft_screen_key(module_id),
            )
        )
        draft_state = result.scalars().first()
        if draft_state is not None:
            await db.delete(draft_state)
            cleared_existing_draft = True

    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == live_screen_key(module_id),
        )
    )
    live_state = result.scalars().first()
    if live_state is None:
        live_state = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=live_screen_key(module_id),
            state_json=screen,
            version=1,
        )
        db.add(live_state)
    else:
        live_state.state_json = screen
        live_state.version += 1

    return live_state.version, cleared_existing_draft


def normalize_screen_for_client(screen: dict[str, Any] | None) -> dict[str, Any] | None:
    if screen is None:
        return None

    from app.mcp.tools import normalize_sdui_screen

    return normalize_sdui_screen(screen)


def validate_sdui_screen_payload(screen: Any) -> tuple[dict[str, Any] | None, list[str]]:
    """Return the normalized storage payload plus any contract validation errors."""
    if not isinstance(screen, dict):
        return None, ["SDUI screen must be a JSON object."]

    from app.mcp.tools import _validate_sdui_v2, normalize_sdui_screen

    normalized_screen = normalize_sdui_screen(screen, convert_legacy_sections=False)

    if "rows" in normalized_screen:
        return normalized_screen, _validate_sdui_v2(normalized_screen)

    if "sections" in normalized_screen:
        if not isinstance(normalized_screen.get("sections"), list):
            return normalized_screen, ["legacy 'sections' must be an array when provided."]
        return normalized_screen, []

    return normalized_screen, [
        "screen must contain either a row-first 'rows' array or a legacy 'sections' array."
    ]


def prepare_sdui_screen_for_storage(screen: dict[str, Any], module_id: str) -> dict[str, Any]:
    """Normalize and validate the persisted SDUI save contract.

    Preferred payloads are row-first (`rows`). Legacy `sections` payloads are
    still accepted for backward compatibility.
    """
    normalized_screen, validation_errors = validate_sdui_screen_payload(screen)
    if validation_errors:
        error_summary = "; ".join(validation_errors[:5])
        raise ValueError(
            f"SDUI validation failed for module '{module_id}': {error_summary}. "
            "Provide a valid row-first screen or use legacy sections for backward compatibility."
        )

    assert normalized_screen is not None
    return normalized_screen


def count_sdui_screen_components(screen: dict[str, Any] | None) -> int:
    """Count top-level authored components for row-first or legacy payloads."""
    if not isinstance(screen, dict):
        return 0

    rows = screen.get("rows")
    if isinstance(rows, list):
        return sum(
            len(row.get("cells", []))
            for row in rows
            if isinstance(row, dict) and isinstance(row.get("cells"), list)
        )

    sections = screen.get("sections")
    if isinstance(sections, list):
        component_count = 0
        for section in sections:
            if not isinstance(section, dict):
                continue
            if isinstance(section.get("components"), list):
                component_count += len(section["components"])
            if isinstance(section.get("component"), dict):
                component_count += 1
        return component_count

    return 0


def count_sdui_screen_layout_items(screen: dict[str, Any] | None) -> int:
    """Return a meaningful top-level layout count for row-first or legacy screens."""
    if not isinstance(screen, dict):
        return 0

    rows = screen.get("rows")
    if isinstance(rows, list):
        return len(rows)

    sections = screen.get("sections")
    if isinstance(sections, list):
        return len(sections)

    return 0


async def send_live_screen_update(
    user_id: str,
    module_id: str,
    screen: dict[str, Any] | None,
    version: int,
) -> None:
    """Broadcast a live screen update using the normalized SDUI payload."""
    await manager.send(user_id, {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": normalize_screen_for_client(screen),
        "version": version,
    })


async def send_draft_update(
    user_id: str,
    module_id: str,
    screen: dict[str, Any] | None,
    version: int,
) -> None:
    """Broadcast draft state changes using the client-facing draft contract."""
    await manager.send(user_id, {
        "type": "sdui_draft_update",
        "module_id": module_id,
        "screen": normalize_screen_for_client(screen),
        "version": version,
    })


async def send_draft_cleared(user_id: str, module_id: str) -> None:
    """Notify clients that a draft has been cleared/rejected."""
    await manager.send(user_id, {
        "type": "sdui_draft_rejected",
        "module_id": module_id,
    })