"""
Action Registry — maps named functions to backend handlers.

SDUI components use `server_action` with a function name instead of raw API URLs.
This registry is the whitelist of allowed functions. Adding a function here makes
it callable from the frontend via POST /api/actions/execute.

Architecture Decision: Session 2, Section 5 — Named Functions vs Raw Endpoints.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import TriggerType
from app.services.workflow_engine import fire_trigger

logger = logging.getLogger(__name__)

# Type for action handler: receives (user_id, params, db_session) -> result dict
ActionHandler = Callable[[str, dict[str, Any], AsyncSession], Awaitable[dict[str, Any]]]


class ActionRegistry:
    """Whitelist registry of named server-side action functions."""

    def __init__(self) -> None:
        self._handlers: dict[str, ActionHandler] = {}

    def register(self, name: str, handler: ActionHandler) -> None:
        self._handlers[name] = handler

    async def execute(self, name: str, user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
        handler = self._handlers.get(name)
        if handler is None:
            raise ValueError(f"Unknown action: {name}")
        return await handler(user_id, params, db)

    def list_functions(self) -> list[str]:
        return list(self._handlers.keys())

    def is_registered(self, name: str) -> bool:
        return name in self._handlers


# ── Built-in Action Handlers ───────────────────────────────────────────────

async def _refresh_data(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Re-fetch and push SDUI screen data for a module."""
    module_id = params.get("module_id", "home")

    # Re-read the current SDUI screen from DB and push it
    from app.models.module_state import ModuleState
    from app.services.sdui_state import send_live_screen_update
    from sqlalchemy import select

    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == f"sdui__{module_id}",
        )
    )
    state = result.scalars().first()
    if state:
        await send_live_screen_update(user_id, module_id, state.state_json, state.version)
    return {"status": "ok", "module_id": module_id, "refreshed": state is not None}


async def _submit_form(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Handle form submission — store form data in module state."""
    from app.models.module_state import ModuleState
    from sqlalchemy import select
    from uuid import uuid4

    form_id = params.pop("_form_id", "default")
    key = f"form_data__{form_id}"

    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == key,
        )
    )
    state = result.scalars().first()
    if state is None:
        state = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=key,
            state_json={"submissions": [params]},
            version=1,
        )
        db.add(state)
    else:
        # Copy the list — mutating in-place corrupts SQLAlchemy's committed state
        submissions = list(state.state_json.get("submissions", []))
        submissions.append(params)
        state.state_json = {"submissions": submissions}
        state.version += 1

    await db.commit()

    await fire_trigger(TriggerType.FORM_SUBMITTED, user_id, {
        "form_id": form_id, "submission_data": params
    })

    # Send notification confirming submission
    from app.services.websocket_manager import manager
    await manager.send(user_id, {
        "type": "notification",
        "title": "Form Submitted",
        "message": "Your form submission was saved.",
        "severity": "success",
    })

    return {"status": "ok", "form_id": form_id, "submission_count": len(state.state_json.get("submissions", []))}


async def _send_to_agent(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Route a message to the AI chat agent."""
    from app.services.agent_proxy import handle_chat_message

    message = params.get("message", "")
    if not message:
        return {"status": "error", "detail": "No message provided"}

    import asyncio
    asyncio.create_task(
        handle_chat_message(
            user_id=user_id,
            content=message,
            conversation_id=params.get("conversation_id", "default"),
        )
    )
    return {"status": "ok", "message": "Sent to agent"}


async def _mark_notification_read(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Mark a notification as read."""
    from app.models.notification import Notification
    from sqlalchemy import select

    notification_id = params.get("notification_id")
    if not notification_id:
        return {"status": "error", "detail": "notification_id required"}

    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalars().first()
    if notif:
        notif.is_read = True
        await db.commit()
    return {"status": "ok", "notification_id": notification_id}


async def _create_calendar_event(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Create a calendar event from SDUI action."""
    from app.models.calendar_event import CalendarEvent
    from uuid import uuid4
    from datetime import datetime

    event = CalendarEvent(
        id=str(uuid4()),
        user_id=user_id,
        title=params.get("title", "New Event"),
        start_time=datetime.fromisoformat(params["start_time"]) if "start_time" in params else datetime.utcnow(),
        end_time=datetime.fromisoformat(params["end_time"]) if "end_time" in params else datetime.utcnow(),
        description=params.get("description", ""),
        color=params.get("color"),
        location=params.get("location"),
        is_all_day=params.get("is_all_day", False),
    )
    db.add(event)
    await db.commit()

    return {"status": "ok", "event_id": event.id, "title": event.title}


async def _delete_calendar_event(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Delete a calendar event."""
    from app.models.calendar_event import CalendarEvent
    from sqlalchemy import select

    event_id = params.get("event_id")
    if not event_id:
        return {"status": "error", "detail": "event_id required"}

    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.user_id == user_id,
        )
    )
    event = result.scalars().first()
    if event:
        await db.delete(event)
        await db.commit()
    return {"status": "ok", "event_id": event_id}


async def _approve_draft(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Approve a draft SDUI screen — make it live."""
    from app.mcp.tools import approve_draft
    module_id = params.get("module_id")
    if not module_id:
        return {"status": "error", "detail": "module_id required"}
    return await approve_draft(module_id=module_id, user_id=user_id)


async def _reject_draft(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Reject a draft SDUI screen."""
    from app.mcp.tools import reject_draft
    module_id = params.get("module_id")
    if not module_id:
        return {"status": "error", "detail": "module_id required"}
    feedback = params.get("feedback")
    return await reject_draft(module_id=module_id, user_id=user_id, feedback=feedback)


# ── Singleton Registry ─────────────────────────────────────────────────────

registry = ActionRegistry()

# Register built-in actions
registry.register("refresh_data", _refresh_data)
registry.register("submit_form", _submit_form)
registry.register("send_to_agent", _send_to_agent)
registry.register("mark_notification_read", _mark_notification_read)
registry.register("create_calendar_event", _create_calendar_event)
registry.register("delete_calendar_event", _delete_calendar_event)
registry.register("approve_draft", _approve_draft)
registry.register("reject_draft", _reject_draft)
