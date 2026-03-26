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
