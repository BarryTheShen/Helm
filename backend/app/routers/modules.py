from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.module_state import ModuleState
from app.models.user import User
from app.schemas.modules import (
    DeviceConfigResponse,
    DeviceConfigUpdate,
    ModuleActionRequest,
    ModuleInfo,
    ModuleListResponse,
    ModuleStateResponse,
    SDUIScreenRequest,
)

router = APIRouter(prefix="/api", tags=["modules"])

# All navigable tabs in display order.  home and modules are add here so the
# AI can manage them alongside the other tabs.
_ALL_TABS: list[ModuleInfo] = [
    ModuleInfo(id="home", name="Home", icon="🏠", enabled=True),
    ModuleInfo(id="chat", name="Chat", icon="💬", enabled=True),
    ModuleInfo(id="modules", name="Modules", icon="🧩", enabled=True),
    ModuleInfo(id="calendar", name="Calendar", icon="📅", enabled=True),
    ModuleInfo(id="forms", name="Forms", icon="📝", enabled=True),
    ModuleInfo(id="alerts", name="Alerts", icon="🔔", enabled=True),
    ModuleInfo(id="settings", name="Settings", icon="⚙️", enabled=True),
]

# Backwards-compat alias used by a few legacy references.
AVAILABLE_MODULES = _ALL_TABS

# Key used to persist per-user tab visibility in ModuleState.
_TABS_CONFIG_KEY = "_tabs_config"


async def _get_hidden_tabs(db: AsyncSession, user_id: str) -> list[str]:
    """Return list of tab IDs the user has hidden."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _TABS_CONFIG_KEY,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        return []
    return (state.state_json or {}).get("hidden_tabs", [])


async def _set_hidden_tabs(db: AsyncSession, user_id: str, hidden_tabs: list[str]) -> None:
    """Persist the updated hidden-tabs list for a user."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _TABS_CONFIG_KEY,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        state = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=_TABS_CONFIG_KEY,
            state_json={"hidden_tabs": hidden_tabs},
            version=1,
        )
        db.add(state)
    else:
        state.state_json = {"hidden_tabs": hidden_tabs}
        state.version += 1
    await db.commit()

DEFAULT_MODULE_STATES: dict[str, dict[str, Any]] = {
    "chat": {"type": "chat", "props": {"messages": [], "streaming": False}, "version": 0},
    "calendar": {"type": "calendar", "props": {"events": [], "view": "month"}, "version": 0},
    "alerts": {"type": "alerts", "props": {"alerts": []}, "version": 0},
    "forms": {"type": "form", "props": {"forms": []}, "version": 0},
    "settings": {"type": "settings", "props": {}, "version": 0},
}


@router.get("/modules", response_model=ModuleListResponse)
async def list_modules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all tabs with per-user enabled/disabled status."""
    hidden = await _get_hidden_tabs(db, str(current_user.id))
    modules = [
        ModuleInfo(id=m.id, name=m.name, icon=m.icon, enabled=m.id not in hidden)
        for m in _ALL_TABS
    ]
    return ModuleListResponse(modules=modules)


@router.delete("/modules/{module_id}", status_code=200)
async def hide_module(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hide a tab from the bottom navigation bar.

    The tab route and its content (data, SDUI screens) are preserved —
    only the nav-bar entry is removed.  A 'tabs_updated' WebSocket event
    is pushed so the frontend updates instantly without polling.
    """
    from app.services.websocket_manager import manager

    valid_ids = {m.id for m in _ALL_TABS}
    if module_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Unknown tab: {module_id}")

    hidden = await _get_hidden_tabs(db, str(current_user.id))
    if module_id not in hidden:
        hidden = hidden + [module_id]
        await _set_hidden_tabs(db, str(current_user.id), hidden)

    modules_payload = [
        {"id": m.id, "name": m.name, "icon": m.icon, "enabled": m.id not in hidden}
        for m in _ALL_TABS
    ]
    await manager.send(str(current_user.id), {"type": "tabs_updated", "modules": modules_payload})
    return {"module_id": module_id, "hidden": True}


@router.post("/modules/{module_id}/show", status_code=200)
async def show_module(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore a previously hidden tab to the bottom navigation bar.

    Pushes a 'tabs_updated' WebSocket event so the frontend adds the tab
    back immediately.
    """
    from app.services.websocket_manager import manager

    valid_ids = {m.id for m in _ALL_TABS}
    if module_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Unknown tab: {module_id}")

    hidden = await _get_hidden_tabs(db, str(current_user.id))
    if module_id in hidden:
        hidden = [t for t in hidden if t != module_id]
        await _set_hidden_tabs(db, str(current_user.id), hidden)

    modules_payload = [
        {"id": m.id, "name": m.name, "icon": m.icon, "enabled": m.id not in hidden}
        for m in _ALL_TABS
    ]
    await manager.send(str(current_user.id), {"type": "tabs_updated", "modules": modules_payload})
    return {"module_id": module_id, "hidden": False}


@router.get("/modules/{module_id}/state", response_model=ModuleStateResponse)
async def get_module_state(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == module_id,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        default = DEFAULT_MODULE_STATES.get(module_id)
        if default is None:
            raise HTTPException(status_code=404, detail="Module not found")
        return ModuleStateResponse(
            type=default["type"],
            props=default["props"],
            version=0,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    return ModuleStateResponse(
        type=state.module_type,
        props=state.state_json,
        version=state.version,
        updated_at=state.updated_at.isoformat(),
    )


@router.post("/modules/{module_id}/action")
async def module_action(
    module_id: str,
    body: ModuleActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Generic action handler — modules can extend this
    return {"status": "ok", "module": module_id, "action": body.action}


@router.get("/devices/config", response_model=DeviceConfigResponse)
async def get_device_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.device import Device
    from app.models.session import Session
    from fastapi import Request
    # Return default config — in full implementation would be per-device
    return DeviceConfigResponse(
        tab_bar_modules=["chat", "calendar", "alerts"],
        default_module="chat",
        nav_mode="tabs",
    )


@router.put("/devices/config", response_model=DeviceConfigResponse)
async def update_device_config(
    body: DeviceConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist device config in module_states so it survives restarts."""
    config = {
        "tab_bar_modules": body.tab_bar_modules or ["chat", "calendar", "alerts"],
        "default_module": body.default_module or "chat",
        "nav_mode": body.nav_mode or "tabs",
    }
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == "device_config",
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        state = ModuleState(
            id=str(uuid4()),
            user_id=str(current_user.id),
            module_type="device_config",
            state_json=config,
            version=1,
        )
        db.add(state)
    else:
        state.state_json = config
        state.version += 1
    await db.commit()
    return DeviceConfigResponse(**config)


# ── SDUI endpoints ────────────────────────────────────────────────────────
# The AI (via MCP helm_set_screen) writes SDUIScreen JSON here.
# The frontend polls GET /api/sdui/{module_id} and renders it natively.

_SDUI_MODULE_PREFIX = "sdui__"


@router.get("/sdui/{module_id}")
async def get_sdui_screen(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current SDUIScreen JSON for a module, or null if not yet set."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == _SDUI_MODULE_PREFIX + module_id,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        return {"screen": None}
    return {"screen": state.state_json, "version": state.version}


@router.post("/sdui/{module_id}", status_code=200)
async def set_sdui_screen(
    module_id: str,
    body: SDUIScreenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a new SDUIScreen JSON for a module and push it to the connected client.

    Called by the AI via the helm_set_screen MCP tool.  The frontend receives
    the screen via WebSocket and re-renders immediately without polling.
    """
    from app.services.websocket_manager import manager

    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == _SDUI_MODULE_PREFIX + module_id,
        )
    )
    state = result.scalar_one_or_none()
    screen_json = body.screen

    if state is None:
        from uuid import uuid4
        state = ModuleState(
            id=str(uuid4()),
            user_id=str(current_user.id),
            module_type=_SDUI_MODULE_PREFIX + module_id,
            state_json=screen_json,
            version=1,
        )
        db.add(state)
    else:
        state.state_json = screen_json
        state.version += 1

    await db.commit()

    # Push to connected frontend over WebSocket so it re-renders immediately
    await manager.send(str(current_user.id), {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": screen_json,
        "version": state.version,
    })

    return {"module_id": module_id, "version": state.version, "updated": True}


@router.delete("/sdui/{module_id}", status_code=200)
async def delete_sdui_screen(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the AI-generated SDUI screen for a module.

    The frontend immediately returns the tab to its empty/default state.
    """
    from app.services.websocket_manager import manager

    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == _SDUI_MODULE_PREFIX + module_id,
        )
    )
    state = result.scalar_one_or_none()
    if state is not None:
        await db.delete(state)
        await db.commit()

    await manager.send(str(current_user.id), {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": None,
        "version": 0,
    })
    return {"module_id": module_id, "deleted": True}


@router.get("/sdui")
async def list_sdui_screens(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all SDUI screens currently set by the AI across all modules."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type.like(_SDUI_MODULE_PREFIX + "%"),
        )
    )
    states = result.scalars().all()
    return {
        "screens": [
            {
                "module_id": s.module_type.removeprefix(_SDUI_MODULE_PREFIX),
                "version": s.version,
                "title": (s.state_json or {}).get("title", ""),
                "sections_count": len((s.state_json or {}).get("sections", [])),
            }
            for s in states
        ]
    }
