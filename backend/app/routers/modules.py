from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user, get_current_user_id
from app.models.module_state import ModuleState
from app.models.user import User
from app.models.screen_history import ScreenHistory
from app.schemas.common import PaginatedResponse
from app.schemas.modules import (
    DeviceConfigResponse,
    DeviceConfigUpdate,
    ModuleActionRequest,
    ModuleInfo,
    ModuleListResponse,
    ModuleStateResponse,
    SDUIScreenRequest,
    TabConfigRequest,
)
from app.schemas.screen_history import ScreenHistoryDetailOut, ScreenHistoryOut
from app.services.audit import log_audit

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


async def _get_tab_overrides(db: AsyncSession, user_id: str) -> dict[str, dict]:
    """Return per-user tab name/icon overrides as {tab_id: {name?, icon?}}."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _TABS_CONFIG_KEY,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        return {}
    return (state.state_json or {}).get("tab_overrides", {})


async def _get_tabs_config(db: AsyncSession, user_id: str) -> dict:
    """Return the full tabs config dict for a user (hidden_tabs + tab_overrides)."""
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _TABS_CONFIG_KEY,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        return {"hidden_tabs": [], "tab_overrides": {}}
    cfg = state.state_json or {}
    cfg.setdefault("hidden_tabs", [])
    cfg.setdefault("tab_overrides", {})
    return cfg


async def _save_tabs_config(db: AsyncSession, user_id: str, config: dict) -> None:
    """Persist the full tabs config for a user."""
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
            state_json=config,
            version=1,
        )
        db.add(state)
    else:
        state.state_json = config
        state.version += 1
    await db.commit()


async def _set_hidden_tabs(db: AsyncSession, user_id: str, hidden_tabs: list[str]) -> None:
    """Persist the updated hidden-tabs list for a user (preserves tab_overrides)."""
    config = await _get_tabs_config(db, user_id)
    config["hidden_tabs"] = hidden_tabs
    await _save_tabs_config(db, user_id, config)


def _build_module_list(hidden: list[str], overrides: dict[str, dict]) -> list[ModuleInfo]:
    """Build the full module list applying per-user overrides on top of defaults."""
    return [
        ModuleInfo(
            id=m.id,
            name=overrides.get(m.id, {}).get("name", m.name),
            icon=overrides.get(m.id, {}).get("icon", m.icon),
            enabled=m.id not in hidden,
        )
        for m in _ALL_TABS
    ]

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
    """Return all tabs with per-user enabled/disabled status and name/icon overrides."""
    config = await _get_tabs_config(db, str(current_user.id))
    modules = _build_module_list(config["hidden_tabs"], config["tab_overrides"])
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

    overrides = await _get_tab_overrides(db, str(current_user.id))
    modules_payload = [m.model_dump() for m in _build_module_list(hidden, overrides)]
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

    overrides = await _get_tab_overrides(db, str(current_user.id))
    modules_payload = [m.model_dump() for m in _build_module_list(hidden, overrides)]
    await manager.send(str(current_user.id), {"type": "tabs_updated", "modules": modules_payload})
    return {"module_id": module_id, "hidden": False}


@router.patch("/modules/{module_id}/config", status_code=200)
async def configure_module(
    module_id: str,
    body: TabConfigRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a tab and/or change its icon.

    The name and icon are stored as per-user overrides so the default labels
    survive a backend restart.  A 'tabs_updated' WebSocket event is pushed
    so the frontend reflects the change immediately.
    """
    from app.services.websocket_manager import manager

    valid_ids = {m.id for m in _ALL_TABS}
    if module_id not in valid_ids:
        raise HTTPException(status_code=404, detail=f"Unknown tab: {module_id}")

    if body.name is None and body.icon is None:
        raise HTTPException(status_code=422, detail="Provide at least 'name' or 'icon'.")

    config = await _get_tabs_config(db, str(current_user.id))
    override = config["tab_overrides"].get(module_id, {})
    if body.name is not None:
        override["name"] = body.name
    if body.icon is not None:
        override["icon"] = body.icon
    config["tab_overrides"][module_id] = override
    await _save_tabs_config(db, str(current_user.id), config)

    modules_payload = [m.model_dump() for m in _build_module_list(config["hidden_tabs"], config["tab_overrides"])]
    await manager.send(str(current_user.id), {"type": "tabs_updated", "modules": modules_payload})

    updated = next(m for m in modules_payload if m["id"] == module_id)
    return updated


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
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Handle actions from SDUI mini-apps in the Modules tab.

    Supported actions (module_id="modules"):
      random_number         — generate a random int 1–1000, update RNG display
      play_rps              — play Rock Paper Scissors (body.choice: rock/paper/scissors)
      create_note           — save a note (body.title, body.content)
      delete_note           — delete a note (body.note_id)

    Each action updates the SDUI screen via WebSocket so the mobile app auto-refreshes.
    """
    import random
    import copy
    from app.services.websocket_manager import manager

    action = body.get("action", "")
    user_id = str(current_user.id)

    # ── Load the current SDUI screen for this module ──────────────────────────
    sdui_key = f"sdui__{module_id}"
    result_q = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == sdui_key,
        )
    )
    state = result_q.scalar_one_or_none()
    screen = copy.deepcopy(state.state_json) if state and state.state_json else None

    # ── Helper: walk screen and update a component by id ──────────────────────
    def _update_comp_by_id(components: list, comp_id: str, updates: dict) -> bool:
        """Recursively find a component by id and apply updates. Returns True if found."""
        for comp in components:
            if comp.get("id") == comp_id:
                # Handle both props-based (normalized) and flat AI-generated formats
                if "props" in comp:
                    for key, val in updates.items():
                        comp["props"][key] = val
                else:
                    comp.update(updates)
                return True
            if "children" in comp:
                if _update_comp_by_id(comp["children"], comp_id, updates):
                    return True
        return False

    def _apply_to_screen(screen: dict, comp_id: str, updates: dict) -> None:
        for section in screen.get("sections", []):
            comps = section.get("components", [])
            if comps and _update_comp_by_id(comps, comp_id, updates):
                return
            if "component" in section:
                comp = section["component"]
                if comp.get("id") == comp_id:
                    if "props" in comp:
                        for key, val in updates.items():
                            comp["props"][key] = val
                    else:
                        comp.update(updates)
                    return
                # Also check children of the section's component
                if _update_comp_by_id(comp.get("children", []), comp_id, updates):
                    return

    # ── Helper: get notes from module_state ───────────────────────────────────
    async def _get_notes() -> list[dict]:
        notes_key = f"notes__{user_id}"
        r = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == notes_key,
            )
        )
        ns = r.scalar_one_or_none()
        return (ns.state_json or {}).get("notes", []) if ns else []

    async def _save_notes(notes: list[dict]) -> None:
        notes_key = f"notes__{user_id}"
        r = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == notes_key,
            )
        )
        ns = r.scalar_one_or_none()
        if ns is None:
            ns = ModuleState(
                id=str(uuid4()),
                user_id=user_id,
                module_type=notes_key,
                state_json={"notes": notes},
                version=1,
            )
            db.add(ns)
        else:
            ns.state_json = {"notes": notes}
            ns.version += 1

    # ── Helper: push updated screen ───────────────────────────────────────────
    async def _push_screen(screen: dict) -> None:
        if state is None:
            return
        state.state_json = screen
        state.version += 1
        await db.commit()
        from app.mcp.tools import normalize_sdui_screen
        await manager.send(user_id, {
            "type": "sdui_screen_update",
            "module_id": module_id,
            "screen": normalize_sdui_screen(screen),
            "version": state.version,
        })

    # ── Actions ───────────────────────────────────────────────────────────────

    if action == "random_number":
        num = random.randint(1, 1000)
        if screen:
            _apply_to_screen(screen, "rng-result", {
                "content": f"🎲 Your number: **{num}**",
            })
            await _push_screen(screen)
        return {"status": "ok", "number": num, "message": f"Generated: {num}"}

    elif action == "play_rps":
        choices = ["rock", "paper", "scissors"]
        user_choice = (body.get("choice") or "").lower().strip()
        if user_choice not in choices:
            return {"status": "error", "message": f"Invalid choice '{user_choice}'"}

        computer = random.choice(choices)
        emojis = {"rock": "🪨", "paper": "📄", "scissors": "✂️"}

        if user_choice == computer:
            result_text = f"Tie! Both chose {emojis[computer]} {computer.title()}"
            result_color = "yellow"
        elif (user_choice, computer) in [("rock", "scissors"), ("paper", "rock"), ("scissors", "paper")]:
            result_text = f"You WIN! 🎉 {emojis[user_choice]} beats {emojis[computer]}"
            result_color = "green"
        else:
            result_text = f"You LOSE! 😢 {emojis[computer]} beats {emojis[user_choice]}"
            result_color = "red"

        if screen:
            _apply_to_screen(screen, "rps-result", {"content": result_text})
            await _push_screen(screen)
        return {"status": "ok", "message": result_text}

    elif action == "create_note":
        title = (body.get("title") or "").strip()
        content = (body.get("content") or "").strip()
        if not title:
            return {"status": "error", "message": "Note title is required"}

        from datetime import datetime, timezone
        note_id = str(uuid4())[:8]
        notes = await _get_notes()
        notes.insert(0, {
            "id": note_id,
            "title": title,
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await _save_notes(notes)
        await db.commit()

        if screen:
            note_items = [
                {
                    "id": n["id"],
                    "title": n["title"],
                    "subtitle": n.get("content", "")[:60] + ("…" if len(n.get("content", "")) > 60 else ""),
                }
                for n in notes
            ]
            _apply_to_screen(screen, "notes-list", {"items": note_items})
            await _push_screen(screen)
        return {"status": "ok", "note_id": note_id, "message": f"Note '{title}' saved!"}

    elif action == "delete_note":
        note_id = body.get("note_id", "")
        notes = await _get_notes()
        notes = [n for n in notes if n.get("id") != note_id]
        await _save_notes(notes)
        await db.commit()

        if screen:
            note_items = [
                {"id": n["id"], "title": n["title"],
                 "subtitle": n.get("content", "")[:60]}
                for n in notes
            ]
            _apply_to_screen(screen, "notes-list", {"items": note_items})
            await _push_screen(screen)
        return {"status": "ok", "message": "Note deleted"}

    else:
        return {"status": "ok", "module": module_id, "action": action}


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
_CONFIG_PREFIX = "config__"


async def _get_module_config(db: AsyncSession, user_id: str, module_id: str) -> dict:
    """Return the config dict for a module (auto_approve_drafts, etc.)."""
    config_key = _CONFIG_PREFIX + module_id
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == config_key,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        return {"auto_approve_drafts": False}
    cfg = state.state_json or {}
    cfg.setdefault("auto_approve_drafts", False)
    return cfg


async def record_screen_history(
    db: AsyncSession,
    user_id: str,
    module_id: str,
    screen_json: dict,
    source: str,
) -> ScreenHistory:
    """Record a screen history entry with the next version number."""
    max_version = await db.execute(
        select(func.max(ScreenHistory.version)).where(
            ScreenHistory.module_id == module_id,
            ScreenHistory.user_id == user_id,
        )
    )
    version = (max_version.scalar() or 0) + 1
    entry = ScreenHistory(
        id=str(uuid4()),
        user_id=user_id,
        module_id=module_id,
        screen_json=screen_json,
        version=version,
        source=source,
    )
    db.add(entry)
    return entry


# ── Static SDUI routes (must come BEFORE /sdui/{module_id} to avoid path conflicts) ──


class ValidateScreenRequest(BaseModel):
    screen_json: dict


@router.post("/sdui/validate", status_code=200)
async def validate_screen(
    body: ValidateScreenRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Validate screen_json against the component registry."""
    from app.models.component_registry import ComponentRegistry

    # Load valid component types
    result = await db.execute(select(ComponentRegistry.type))
    valid_types = {r[0] for r in result.all()}

    errors: list[str] = []
    screen = body.screen_json

    # Walk sections/rows and check component types
    sections = screen.get("sections", []) + screen.get("rows", [])
    for i, section in enumerate(sections):
        components = section.get("components", [])
        if "component" in section:
            components = [section["component"]] + components
        for j, comp in enumerate(components):
            comp_type = comp.get("type")
            if comp_type and valid_types and comp_type not in valid_types:
                errors.append(f"sections[{i}].components[{j}]: unknown type '{comp_type}'")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "component_count": sum(
            len(s.get("components", [])) + (1 if "component" in s else 0)
            for s in sections
        ),
    }


@router.get("/sdui/modules")
async def list_sdui_modules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all modules available for SDUI editing (used by web admin editor)."""
    # Find which modules already have a saved SDUI screen
    result = await db.execute(
        select(ModuleState.module_type).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type.like(_SDUI_MODULE_PREFIX + "%"),
            ~ModuleState.module_type.like("%__draft"),
            ~ModuleState.module_type.like("%__config"),
        )
    )
    existing_keys = {row[0] for row in result.all()}

    items = []
    for tab in _ALL_TABS:
        sdui_key = _SDUI_MODULE_PREFIX + tab.id
        items.append({
            "module_id": tab.id,
            "name": tab.name,
            "icon": tab.icon,
            "has_screen": sdui_key in existing_keys,
        })
    return {"items": items}


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
    from app.mcp.tools import normalize_sdui_screen
    return {"screen": normalize_sdui_screen(state.state_json), "version": state.version}


@router.post("/sdui/{module_id}", status_code=200)
async def set_sdui_screen(
    module_id: str,
    body: SDUIScreenRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a new SDUIScreen JSON for a module and push it to the connected client.

    Called by the AI via the helm_set_screen MCP tool.  The frontend receives
    the screen via WebSocket and re-renders immediately without polling.

    If auto_approve_drafts is False (default) for this module, the screen is
    saved as a draft requiring approval.  If True, the screen goes live directly.
    """
    from app.services.websocket_manager import manager

    user_id = str(current_user.id)
    screen_json = body.screen

    # Check auto-approve config for this module
    config = await _get_module_config(db, user_id, module_id)
    auto_approve = config.get("auto_approve_drafts", False)

    if not auto_approve:
        # Save as draft — requires human approval
        draft_key = _SDUI_MODULE_PREFIX + module_id + "__draft"
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == draft_key,
            )
        )
        draft = result.scalar_one_or_none()
        if draft is None:
            draft = ModuleState(
                id=str(uuid4()),
                user_id=user_id,
                module_type=draft_key,
                state_json=screen_json,
                version=1,
            )
            db.add(draft)
        else:
            draft.state_json = screen_json
            draft.version += 1

        await log_audit(db, user_id, "SCREEN_DRAFT_CREATED", "screen", module_id, ip=request.client.host if request.client else None)
        await record_screen_history(db, user_id, module_id, screen_json, source="draft")
        await db.commit()

        # Notify frontend a new draft is available
        await manager.send(user_id, {
            "type": "sdui_draft_available",
            "module_id": module_id,
            "version": draft.version,
        })

        return {"module_id": module_id, "version": draft.version, "draft": True, "updated": True}

    # Auto-approve: set screen live directly
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _SDUI_MODULE_PREFIX + module_id,
        )
    )
    state = result.scalar_one_or_none()

    if state is None:
        state = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=_SDUI_MODULE_PREFIX + module_id,
            state_json=screen_json,
            version=1,
        )
        db.add(state)
    else:
        state.state_json = screen_json
        state.version += 1

    await log_audit(db, user_id, "SCREEN_SET", "screen", module_id, ip=request.client.host if request.client else None)
    await record_screen_history(db, user_id, module_id, screen_json, source="api")
    await db.commit()

    # Push to connected frontend over WebSocket so it re-renders immediately
    await manager.send(user_id, {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": screen_json,
        "version": state.version,
    })

    return {"module_id": module_id, "version": state.version, "updated": True}


@router.delete("/sdui/{module_id}", status_code=200)
async def delete_sdui_screen(
    module_id: str,
    request: Request,
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
        await log_audit(db, str(current_user.id), "SCREEN_DELETED", "screen", module_id, ip=request.client.host if request.client else None)
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


# ── Module config endpoints (auto-approve toggle) ─────────────────────────


class ModuleConfigRequest(BaseModel):
    auto_approve_drafts: bool = False


@router.get("/sdui/{module_id}/config")
async def get_module_config(
    module_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the config for a module (auto_approve_drafts, etc.)."""
    return await _get_module_config(db, current_user_id, module_id)


@router.put("/sdui/{module_id}/config")
async def set_module_config(
    module_id: str,
    body: ModuleConfigRequest,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Store/update config for a module."""
    config_key = _CONFIG_PREFIX + module_id
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == current_user_id,
            ModuleState.module_type == config_key,
        )
    )
    state = result.scalar_one_or_none()
    config_data = {"auto_approve_drafts": body.auto_approve_drafts}
    if state is None:
        state = ModuleState(
            id=str(uuid4()),
            user_id=current_user_id,
            module_type=config_key,
            state_json=config_data,
            version=1,
        )
        db.add(state)
    else:
        state.state_json = config_data
        state.version += 1
    await db.commit()
    return config_data


# ── Draft management endpoints ─────────────────────────────────────────────
# Architecture Decision: Session 2, Section 8 — Human-in-the-Loop.

@router.get("/sdui/{module_id}/draft")
async def get_draft(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current draft screen for a module, if any."""
    draft_key = _SDUI_MODULE_PREFIX + module_id + "__draft"
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == draft_key,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        return {"screen": None, "has_draft": False}
    return {"screen": draft.state_json, "version": draft.version, "has_draft": True}


@router.post("/sdui/{module_id}/draft/approve")
async def approve_draft(
    module_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a draft screen — promote it to the live screen."""
    from app.services.websocket_manager import manager

    draft_key = _SDUI_MODULE_PREFIX + module_id + "__draft"
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == draft_key,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        raise HTTPException(status_code=404, detail=f"No draft found for module '{module_id}'")

    screen_json = draft.state_json

    # Delete the draft
    await db.delete(draft)

    # Upsert the live screen
    live_key = _SDUI_MODULE_PREFIX + module_id
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == live_key,
        )
    )
    live_state = result.scalar_one_or_none()
    if live_state is None:
        live_state = ModuleState(
            id=str(uuid4()),
            user_id=str(current_user.id),
            module_type=live_key,
            state_json=screen_json,
            version=1,
        )
        db.add(live_state)
    else:
        live_state.state_json = screen_json
        live_state.version += 1

    await log_audit(db, str(current_user.id), "SCREEN_APPROVED", "screen", module_id, ip=request.client.host if request.client else None)
    await db.commit()

    # Push live screen update
    await manager.send(str(current_user.id), {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": screen_json,
        "version": live_state.version,
    })
    return {"module_id": module_id, "version": live_state.version, "approved": True}


@router.post("/sdui/{module_id}/draft/reject")
async def reject_draft(
    module_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a draft screen — discard it."""
    from app.services.websocket_manager import manager

    draft_key = _SDUI_MODULE_PREFIX + module_id + "__draft"
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == draft_key,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        raise HTTPException(status_code=404, detail=f"No draft found for module '{module_id}'")

    await db.delete(draft)
    await log_audit(db, str(current_user.id), "SCREEN_REJECTED", "screen", module_id, ip=request.client.host if request.client else None)
    await db.commit()

    await manager.send(str(current_user.id), {
        "type": "sdui_draft_rejected",
        "module_id": module_id,
    })
    return {"module_id": module_id, "rejected": True}


# ── Screen History endpoints ──────────────────────────────────────────────


@router.get("/sdui/{module_id}/history", response_model=PaginatedResponse[ScreenHistoryOut])
async def list_screen_history(
    module_id: str,
    pagination: PaginationParams = Depends(),
    source: str | None = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List version history for a module, sorted by version DESC."""
    query = select(ScreenHistory).where(
        ScreenHistory.module_id == module_id,
        ScreenHistory.user_id == current_user_id,
    )
    if source:
        query = query.where(ScreenHistory.source == source)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ScreenHistory.version.desc())
    query = query.offset(pagination.offset).limit(pagination.limit)
    results = (await db.execute(query)).scalars().all()

    return PaginatedResponse[ScreenHistoryOut](
        items=[ScreenHistoryOut.model_validate(r) for r in results],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < total,
    )


@router.get("/sdui/{module_id}/history/{version}", response_model=ScreenHistoryDetailOut)
async def get_screen_history_version(
    module_id: str,
    version: int,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full screen_json for a specific history version."""
    result = await db.execute(
        select(ScreenHistory).where(
            ScreenHistory.module_id == module_id,
            ScreenHistory.user_id == current_user_id,
            ScreenHistory.version == version,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Version {version} not found for module '{module_id}'")
    return ScreenHistoryDetailOut.model_validate(entry)


@router.post("/sdui/{module_id}/history/{version}/restore", status_code=200)
async def restore_screen_version(
    module_id: str,
    version: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore a historical version by creating a draft from it."""
    user_id = str(current_user.id)
    result = await db.execute(
        select(ScreenHistory).where(
            ScreenHistory.module_id == module_id,
            ScreenHistory.user_id == user_id,
            ScreenHistory.version == version,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Version {version} not found for module '{module_id}'")

    screen_json = entry.screen_json
    draft_key = _SDUI_MODULE_PREFIX + module_id + "__draft"
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == draft_key,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        draft = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=draft_key,
            state_json=screen_json,
            version=1,
        )
        db.add(draft)
    else:
        draft.state_json = screen_json
        draft.version += 1

    await db.commit()

    from app.services.websocket_manager import manager
    await manager.send(user_id, {
        "type": "sdui_draft_ready",
        "module_id": module_id,
        "screen": screen_json,
        "version": draft.version,
    })
    return {"module_id": module_id, "restored_version": version, "draft_version": draft.version}


@router.put("/sdui/{module_id}/history/{version}/star", status_code=200)
async def toggle_star_version(
    module_id: str,
    version: int,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Toggle is_starred on a history entry."""
    result = await db.execute(
        select(ScreenHistory).where(
            ScreenHistory.module_id == module_id,
            ScreenHistory.user_id == current_user_id,
            ScreenHistory.version == version,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Version {version} not found for module '{module_id}'")

    entry.is_starred = not entry.is_starred
    await db.commit()
    return {"module_id": module_id, "version": version, "is_starred": entry.is_starred}


class DuplicateRequest(BaseModel):
    target_module_id: str


@router.post("/sdui/{module_id}/duplicate", status_code=200)
async def duplicate_screen(
    module_id: str,
    body: DuplicateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone a module's live screen to a target module as a draft."""
    user_id = str(current_user.id)

    # Get source screen
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _SDUI_MODULE_PREFIX + module_id,
        )
    )
    source_state = result.scalar_one_or_none()
    if source_state is None or not source_state.state_json:
        raise HTTPException(status_code=404, detail=f"No screen found for module '{module_id}'")

    screen_json = source_state.state_json
    target = body.target_module_id

    # Create draft on target
    draft_key = _SDUI_MODULE_PREFIX + target + "__draft"
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == draft_key,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        draft = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=draft_key,
            state_json=screen_json,
            version=1,
        )
        db.add(draft)
    else:
        draft.state_json = screen_json
        draft.version += 1

    await record_screen_history(db, user_id, target, screen_json, source="api")
    await db.commit()

    from app.services.websocket_manager import manager
    await manager.send(user_id, {
        "type": "sdui_draft_ready",
        "module_id": target,
        "screen": screen_json,
        "version": draft.version,
    })
    return {"source_module_id": module_id, "target_module_id": target, "draft_version": draft.version}
