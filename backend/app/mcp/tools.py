"""MCP tool implementations — called both by the agent proxy and the MCP server."""

from datetime import datetime
from typing import Any
from uuid import uuid4

from loguru import logger
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.calendar_event import CalendarEvent
from app.models.chat_message import ChatMessage
from app.models.module_state import ModuleState
from app.models.notification import Notification


async def execute_tool(name: str, args: dict[str, Any], user_id: str) -> Any:
    """Dispatch a tool call by name."""
    handlers: dict[str, Any] = {
        "read_calendar": read_calendar,
        "create_event": create_event,
        "update_event": update_event,
        "delete_event": delete_event,
        "send_notification": send_notification,
        "get_chat_history": get_chat_history,
        "send_chat_message": send_chat_message,
        "update_module_state": update_module_state,
        "get_form_data": get_form_data,
        "set_screen": set_screen,
        "delete_screen": delete_screen,
        "list_screens": list_screens,
        "hide_tab": hide_tab,
        "show_tab": show_tab,
        "list_tabs": list_tabs,
    }
    handler = handlers.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    return await handler(**args, user_id=user_id)


async def read_calendar(
    start_date: str,
    end_date: str,
    user_id: str,
) -> list[dict[str, Any]]:
    async with AsyncSessionLocal() as db:
        query = select(CalendarEvent).where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.start_time >= datetime.fromisoformat(start_date),
            CalendarEvent.end_time <= datetime.fromisoformat(end_date + "T23:59:59"),
        ).order_by(CalendarEvent.start_time)
        result = await db.execute(query)
        events = result.scalars().all()
        return [
            {
                "id": str(e.id),
                "title": e.title,
                "start_time": e.start_time.isoformat(),
                "end_time": e.end_time.isoformat(),
                "description": e.description,
                "color": e.color,
                "location": e.location,
                "all_day": e.is_all_day,
            }
            for e in events
        ]


async def create_event(
    title: str,
    start_time: str,
    end_time: str,
    user_id: str,
    description: str | None = None,
    color: str | None = None,
    location: str | None = None,
) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        event = CalendarEvent(
            id=str(uuid4()),
            user_id=user_id,
            title=title,
            start_time=datetime.fromisoformat(start_time),
            end_time=datetime.fromisoformat(end_time),
            description=description,
            color=color,
            location=location,
        )
        db.add(event)
        await db.commit()
        return {"id": str(event.id), "title": event.title, "created": True}


async def update_event(
    event_id: str,
    user_id: str,
    title: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    description: str | None = None,
    color: str | None = None,
    location: str | None = None,
) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id,
                CalendarEvent.user_id == user_id,
            )
        )
        event = result.scalar_one_or_none()
        if event is None:
            raise ValueError(f"Event {event_id} not found")
        if title is not None:
            event.title = title
        if start_time is not None:
            event.start_time = datetime.fromisoformat(start_time)
        if end_time is not None:
            event.end_time = datetime.fromisoformat(end_time)
        if description is not None:
            event.description = description
        if color is not None:
            event.color = color
        if location is not None:
            event.location = location
        await db.commit()
        return {"id": str(event.id), "updated": True}


async def delete_event(event_id: str, user_id: str) -> dict[str, Any]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CalendarEvent).where(
                CalendarEvent.id == event_id,
                CalendarEvent.user_id == user_id,
            )
        )
        event = result.scalar_one_or_none()
        if event is None:
            raise ValueError(f"Event {event_id} not found")
        await db.delete(event)
        await db.commit()
        return {"deleted": True}


async def delete_all_events(user_id: str) -> dict[str, Any]:
    """Delete every calendar event for the user in a single database transaction.

    Prefer this over calling delete_event in a loop — it avoids O(N) LLM
    context growth that causes token explosion on large calendars.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CalendarEvent).where(CalendarEvent.user_id == user_id)
        )
        events = result.scalars().all()
        count = len(events)
        for event in events:
            await db.delete(event)
        await db.commit()
        return {"deleted_count": count}


async def read_all_calendar(user_id: str) -> list[dict[str, Any]]:
    """Return all calendar events for the user regardless of date range.

    Use this when you need a full picture of the user’s schedule (e.g. before
    bulk-deleting or auditing events) instead of guessing a wide date range.
    """
    async with AsyncSessionLocal() as db:
        query = (
            select(CalendarEvent)
            .where(CalendarEvent.user_id == user_id)
            .order_by(CalendarEvent.start_time)
        )
        result = await db.execute(query)
        events = result.scalars().all()
        return [
            {
                "id": str(e.id),
                "title": e.title,
                "start_time": e.start_time.isoformat(),
                "end_time": e.end_time.isoformat(),
                "description": e.description,
                "color": e.color,
                "location": e.location,
                "all_day": e.is_all_day,
            }
            for e in events
        ]


async def send_notification(
    title: str,
    message: str,
    severity: str,
    user_id: str,
    actions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    from app.services.websocket_manager import manager

    async with AsyncSessionLocal() as db:
        notif = Notification(
            id=str(uuid4()),
            user_id=user_id,
            title=title,
            message=message,
            severity=severity,
            actions=actions,
        )
        db.add(notif)
        await db.commit()
        notif_id = str(notif.id)

    # Push to connected client
    await manager.send(user_id, {
        "type": "notification",
        "id": notif_id,
        "title": title,
        "message": message,
        "severity": severity,
        "actions": actions,
    })
    return {"id": notif_id, "sent": True}


async def get_chat_history(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        messages = list(reversed(result.scalars().all()))
        return [
            {"id": str(m.id), "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in messages
        ]


async def send_chat_message(content: str, user_id: str) -> dict[str, Any]:
    from app.services.websocket_manager import manager

    msg_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        msg = ChatMessage(
            id=msg_id,
            user_id=user_id,
            role="assistant",
            content=content,
        )
        db.add(msg)
        await db.commit()

    await manager.send(user_id, {
        "type": "chat_complete",
        "message_id": msg_id,
        "content": content,
    })
    return {"id": msg_id, "sent": True}


async def update_module_state(
    module_type: str,
    state: dict[str, Any],
    user_id: str,
) -> dict[str, Any]:
    from app.services.websocket_manager import manager

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == module_type,
            )
        )
        module_state = result.scalar_one_or_none()
        if module_state is None:
            module_state = ModuleState(
                id=str(uuid4()),
                user_id=user_id,
                module_type=module_type,
                state_json=state,
                version=1,
            )
            db.add(module_state)
        else:
            module_state.state_json = state
            module_state.version += 1
        await db.commit()
        version = module_state.version

    # Push updated state to client
    await manager.send(user_id, {
        "type": "module_state_update",
        "module": module_type,
        "state": state,
        "version": version,
    })
    return {"module": module_type, "version": version, "updated": True}


async def get_form_data(form_id: str | None = None, user_id: str = "") -> dict[str, Any]:
    # MVP stub — forms stored in module_state
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == "forms",
            )
        )
        state = result.scalar_one_or_none()
        return state.state_json if state else {"forms": []}


# ── SDUI tools ─────────────────────────────────────────────────────────────
# AI-facing tool to set/get a full SDUIScreen for a module.

_SDUI_PREFIX = "sdui__"


async def set_screen(module_id: str, screen: dict[str, Any], user_id: str) -> dict[str, Any]:
    """Persist an SDUIScreen JSON for *module_id* and push it to the frontend.

    The screen must follow the SDUIScreen schema:
      { schema_version: 1, module_id, title, sections: [...] }
    """
    from app.services.websocket_manager import manager

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == _SDUI_PREFIX + module_id,
            )
        )
        state = result.scalar_one_or_none()
        if state is None:
            state = ModuleState(
                id=str(uuid4()),
                user_id=user_id,
                module_type=_SDUI_PREFIX + module_id,
                state_json=screen,
                version=1,
            )
            db.add(state)
        else:
            state.state_json = screen
            state.version += 1
        await db.commit()
        version = state.version

    await manager.send(user_id, {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": screen,
        "version": version,
    })
    return {"module_id": module_id, "version": version, "updated": True}


async def get_screen(module_id: str, user_id: str) -> dict[str, Any]:
    """Return the current SDUIScreen JSON for *module_id*, or null if not yet set."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == _SDUI_PREFIX + module_id,
            )
        )
        state = result.scalar_one_or_none()
    if state is None:
        return {"screen": None}
    return {"screen": state.state_json, "version": state.version}


async def delete_screen(module_id: str, user_id: str) -> dict[str, Any]:
    """Delete the SDUI screen for *module_id*, returning the tab to its empty state."""
    from app.services.websocket_manager import manager

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == _SDUI_PREFIX + module_id,
            )
        )
        state = result.scalar_one_or_none()
        if state is not None:
            await db.delete(state)
            await db.commit()

    await manager.send(user_id, {
        "type": "sdui_screen_update",
        "module_id": module_id,
        "screen": None,
        "version": 0,
    })
    return {"module_id": module_id, "deleted": True}


async def list_screens(user_id: str) -> dict[str, Any]:
    """List all SDUI screens the AI has set, across all modules."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type.like(_SDUI_PREFIX + "%"),
            )
        )
        states = result.scalars().all()
    return {
        "screens": [
            {
                "module_id": s.module_type.removeprefix(_SDUI_PREFIX),
                "version": s.version,
                "title": (s.state_json or {}).get("title", ""),
                "sections_count": len((s.state_json or {}).get("sections", [])),
            }
            for s in states
        ]
    }


# ── Tab management tools ───────────────────────────────────────────────────
# These tools let the AI show or hide tabs from the bottom navigation bar.
# Tab content (data, SDUI screens) is always preserved — only visibility changes.

_TABS_CONFIG_KEY = "_tabs_config"

_ALL_TAB_DETAILS = [
    {"id": "home", "name": "Home", "icon": "🏠"},
    {"id": "chat", "name": "Chat", "icon": "💬"},
    {"id": "modules", "name": "Modules", "icon": "🧩"},
    {"id": "calendar", "name": "Calendar", "icon": "📅"},
    {"id": "forms", "name": "Forms", "icon": "📝"},
    {"id": "alerts", "name": "Alerts", "icon": "🔔"},
    {"id": "settings", "name": "Settings", "icon": "⚙️"},
]
_ALL_TAB_IDS = [t["id"] for t in _ALL_TAB_DETAILS]


async def _get_hidden_tabs_for_user(user_id: str) -> list[str]:
    async with AsyncSessionLocal() as db:
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


async def _set_hidden_tabs_for_user(user_id: str, hidden_tabs: list[str]) -> None:
    async with AsyncSessionLocal() as db:
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


async def hide_tab(tab_id: str, user_id: str) -> dict[str, Any]:
    """Hide a tab from the bottom nav bar.  Content and data are preserved."""
    from app.services.websocket_manager import manager

    if tab_id not in _ALL_TAB_IDS:
        raise ValueError(f"Unknown tab '{tab_id}'. Valid tabs: {', '.join(_ALL_TAB_IDS)}")

    hidden = await _get_hidden_tabs_for_user(user_id)
    if tab_id not in hidden:
        hidden = hidden + [tab_id]
        await _set_hidden_tabs_for_user(user_id, hidden)

    modules = [
        {"id": t["id"], "name": t["name"], "icon": t["icon"], "enabled": t["id"] not in hidden}
        for t in _ALL_TAB_DETAILS
    ]
    await manager.send(user_id, {"type": "tabs_updated", "modules": modules})
    return {"tab_id": tab_id, "hidden": True, "message": f"'{tab_id}' tab hidden from navigation."}


async def show_tab(tab_id: str, user_id: str) -> dict[str, Any]:
    """Restore a previously hidden tab to the bottom nav bar."""
    from app.services.websocket_manager import manager

    if tab_id not in _ALL_TAB_IDS:
        raise ValueError(f"Unknown tab '{tab_id}'. Valid tabs: {', '.join(_ALL_TAB_IDS)}")

    hidden = await _get_hidden_tabs_for_user(user_id)
    if tab_id in hidden:
        hidden = [t for t in hidden if t != tab_id]
        await _set_hidden_tabs_for_user(user_id, hidden)

    modules = [
        {"id": t["id"], "name": t["name"], "icon": t["icon"], "enabled": t["id"] not in hidden}
        for t in _ALL_TAB_DETAILS
    ]
    await manager.send(user_id, {"type": "tabs_updated", "modules": modules})
    return {"tab_id": tab_id, "hidden": False, "message": f"'{tab_id}' tab is now visible in navigation."}


async def list_tabs(user_id: str) -> dict[str, Any]:
    """List all tabs and their current visibility status."""
    hidden = await _get_hidden_tabs_for_user(user_id)
    tabs = [
        {"id": t["id"], "name": t["name"], "icon": t["icon"], "visible": t["id"] not in hidden}
        for t in _ALL_TAB_DETAILS
    ]
    return {"tabs": tabs}
