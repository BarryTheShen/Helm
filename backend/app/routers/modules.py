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
    await db.commit()

    await manager.send(str(current_user.id), {
        "type": "sdui_draft_rejected",
        "module_id": module_id,
    })
    return {"module_id": module_id, "rejected": True}
