"""
Action Registry — maps named functions to backend handlers.

SDUI components use `server_action` with a function name instead of raw API URLs.
This registry is the whitelist of allowed functions. Adding a function here makes
it callable from the frontend via POST /api/actions/execute.

Architecture Decision: Session 2, Section 5 — Named Functions vs Raw Endpoints.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
from typing import Any, Callable, Awaitable

import feedparser
import httpx
from cryptography.fernet import Fernet
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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
    """Re-fetch and push SDUI screen data for a module, or query a data source."""
    # If a dataSourceId is provided, query that specific data source
    data_source_id = params.get("dataSourceId")
    if data_source_id:
        from app.models.data_source import DataSource
        from app.services.data_connectors import query_data_source
        from sqlalchemy import select

        result = await db.execute(
            select(DataSource).where(
                DataSource.id == data_source_id,
                DataSource.user_id == user_id,
            )
        )
        source = result.scalars().first()
        if source is None:
            return {"status": "error", "detail": "Data source not found"}
        data = await query_data_source(
            source_type=source.type,
            user_id=user_id,
            db=db,
            filters=params.get("filters"),
            limit=params.get("limit", 50),
            offset=params.get("offset", 0),
        )
        return {"status": "ok", "source_id": data_source_id, "data": data, "count": len(data)}

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

    await fire_trigger("form_submitted", user_id, {
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


async def _set_variable(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Upsert a custom variable — create if it doesn't exist, update if it does."""
    from app.models.custom_variable import CustomVariable
    from sqlalchemy import select
    from uuid import uuid4

    name = params.get("name")
    if not name:
        return {"status": "error", "detail": "name required"}
    value = str(params.get("value", ""))
    var_type = params.get("type", "text")

    result = await db.execute(
        select(CustomVariable).where(
            CustomVariable.user_id == user_id,
            CustomVariable.name == name,
        )
    )
    variable = result.scalars().first()
    if variable is None:
        variable = CustomVariable(
            id=str(uuid4()),
            user_id=user_id,
            name=name,
            value=value,
            type=var_type,
        )
        db.add(variable)
    else:
        variable.value = value
        if var_type:
            variable.type = var_type

    await db.commit()
    return {"status": "ok", "name": name, "value": value, "created": variable.id is not None}


# ── Client-Only Action Stubs ──────────────────────────────────────────────
# These actions are handled entirely on the client side.  The backend handler
# simply acknowledges receipt so the action registry has a complete catalog.

async def _client_only(action_name: str) -> ActionHandler:
    """Factory is not used — each stub is defined inline for clarity."""
    ...


async def _navigate(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "navigate"}


async def _go_back(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "go_back"}


async def _open_url(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "open_url"}


async def _set_component_state(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "set_component_state"}


async def _toggle(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "toggle"}


async def _show_notification(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "show_notification"}


async def _show_alert(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "show_alert"}


async def _haptic(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "haptic"}


async def _share(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "share"}


async def _copy_text(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "copy_text"}


async def _delay(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "delay"}


async def _chain(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "chain"}


async def _conditional(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    return {"status": "client_only", "action": "conditional"}


async def _server_action(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Generic server action — dispatches to a named function if provided."""
    function_name = params.get("function")
    if not function_name:
        return {"status": "error", "detail": "No function name provided in server_action"}
    # Re-dispatch through the registry (excluding self to avoid infinite recursion)
    if function_name == "server_action":
        return {"status": "error", "detail": "Recursive server_action not allowed"}
    return await registry.execute(function_name, user_id, params, db)


async def _fetch_rss(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Fetch and parse an RSS feed, returning normalized article data."""
    feed_url = params.get("feed_url")
    if not feed_url:
        return {"status": "error", "detail": "feed_url parameter is required"}

    try:
        # Parse the RSS feed
        feed = feedparser.parse(feed_url)

        # Check for parsing errors
        if feed.bozo and not feed.entries:
            error_msg = getattr(feed.bozo_exception, "getMessage", lambda: str(feed.bozo_exception))()
            return {"status": "error", "detail": f"Failed to parse RSS feed: {error_msg}"}

        # Extract and normalize entries
        articles = []
        for entry in feed.entries:
            article = {
                "title": entry.get("title", "Untitled"),
                "description": entry.get("summary", entry.get("description", "")),
                "link": entry.get("link", ""),
                "published": entry.get("published", entry.get("updated", "")),
                "source": feed.feed.get("title", feed_url),
            }
            articles.append(article)

        return {"status": "ok", "articles": articles}

    except Exception as e:
        logger.error(f"Error fetching RSS feed {feed_url}: {e}")
        return {"status": "error", "detail": f"Failed to fetch RSS feed: {str(e)}"}


def _get_fernet() -> Fernet:
    """Get Fernet cipher using the encryption key from settings."""
    if not settings.encryption_key:
        raise ValueError("ENCRYPTION_KEY must be set in environment variables")
    return Fernet(settings.encryption_key.encode())


def _decrypt_credentials(encrypted: str) -> dict:
    """Decrypt encrypted credentials string, return dict."""
    json_str = _get_fernet().decrypt(encrypted.encode()).decode()
    return json.loads(json_str)


async def _fetch_weather(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Fetch weather data from OpenWeatherMap API."""
    location = params.get("location")
    connection_id = params.get("connection_id")

    if not location:
        return {"status": "error", "detail": "Missing 'location' parameter"}
    if not connection_id:
        return {"status": "error", "detail": "Missing 'connection_id' parameter"}

    # Query connection
    from app.models.connection import Connection
    from sqlalchemy import select

    result = await db.execute(
        select(Connection).where(
            Connection.id == connection_id,
            Connection.user_id == user_id,
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        return {"status": "error", "detail": "Connection not found"}

    # Decrypt credentials to get API key
    try:
        credentials = _decrypt_credentials(connection.credentials_encrypted)
        api_key = credentials.get("api_key")
        if not api_key:
            return {"status": "error", "detail": "API key not found in connection credentials"}
    except Exception as e:
        logger.exception("Failed to decrypt connection credentials")
        return {"status": "error", "detail": f"Failed to decrypt credentials: {str(e)}"}

    # Call OpenWeatherMap API
    url = "https://api.openweathermap.org/data/2.5/weather"
    params_dict = {
        "q": location,
        "appid": api_key,
        "units": "metric",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params_dict)
            response.raise_for_status()
            data = response.json()

        # Extract relevant fields
        temperature = data.get("main", {}).get("temp")
        description = data.get("weather", [{}])[0].get("description", "")
        icon = data.get("weather", [{}])[0].get("icon", "")

        return {
            "status": "ok",
            "temperature": temperature,
            "description": description,
            "icon": icon,
        }
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenWeatherMap API error: {e.response.status_code} - {e.response.text}")
        return {"status": "error", "detail": f"API error: {e.response.status_code}"}
    except httpx.RequestError as e:
        logger.error(f"Network error calling OpenWeatherMap: {e}")
        return {"status": "error", "detail": f"Network error: {str(e)}"}
    except Exception as e:
        logger.exception("Weather fetch failed")
        return {"status": "error", "detail": str(e)}


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
registry.register("set_variable", _set_variable)

# Session 8 additions — navigation
registry.register("navigate", _navigate)
registry.register("go_back", _go_back)
registry.register("open_url", _open_url)

# Session 8 additions — data
registry.register("server_action", _server_action)

# Session 8 additions — state
registry.register("set_component_state", _set_component_state)
registry.register("toggle", _toggle)

# Session 8 additions — feedback
registry.register("show_notification", _show_notification)
registry.register("show_alert", _show_alert)
registry.register("haptic", _haptic)
registry.register("share", _share)

# Session 8 additions — utility
registry.register("copy_text", _copy_text)
registry.register("delay", _delay)

# Session 8 additions — flow control
registry.register("chain", _chain)
registry.register("conditional", _conditional)

# Session 9 additions — RSS feed fetching
registry.register("fetch_rss", _fetch_rss)

# Session 9 additions — weather fetching
registry.register("fetch_weather", _fetch_weather)


async def _run_workflow(user_id: str, params: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Execute a workflow by ID."""
    from app.models.workflow import Workflow
    from sqlalchemy import select

    workflow_id = params.get("workflow_id")
    if not workflow_id:
        return {"status": "error", "detail": "workflow_id is required"}

    # Query workflow
    result = await db.execute(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.user_id == user_id,
        )
    )
    workflow = result.scalars().first()

    if workflow is None:
        return {"status": "error", "detail": "Workflow not found"}

    if not workflow.enabled:
        return {"status": "error", "detail": "Workflow is disabled"}

    # Execute workflow
    try:
        from app.services.workflow_engine import _execute_workflow

        # Execute workflow with optional event data
        event_data = params.get("event_data", {})
        await _execute_workflow(workflow_id, event_data)

        return {
            "status": "ok",
            "result": {
                "workflow_id": workflow_id,
                "workflow_name": workflow.name,
                "executed": True,
            }
        }
    except Exception as e:
        logger.error(f"Failed to execute workflow {workflow_id}: {e}")
        return {"status": "error", "detail": f"Workflow execution failed: {str(e)}"}


# Session 9 additions — workflow execution
registry.register("run_workflow", _run_workflow)
