"""MCP server — exposes Helm tools to external AI agents via Streamable HTTP.

Mounted at /mcp on the FastAPI app.
Authentication: Bearer token in Authorization header.
"""

from mcp.server.fastmcp import FastMCP

from app.mcp.tools import (
    create_event,
    delete_event,
    get_chat_history,
    get_form_data,
    read_calendar,
    send_chat_message,
    send_notification,
    update_event,
    update_module_state,
)

# MCP context var for user_id (set per-request by auth middleware)
import contextvars
_current_user_id: contextvars.ContextVar[str] = contextvars.ContextVar("_current_user_id", default="")


def get_current_user_id() -> str:
    return _current_user_id.get()


mcp = FastMCP("Helm")


@mcp.tool()
async def helm_read_calendar(start_date: str, end_date: str) -> list:
    """Get calendar events for a date range (YYYY-MM-DD format)."""
    return await read_calendar(start_date, end_date, get_current_user_id())


@mcp.tool()
async def helm_create_event(
    title: str,
    start_time: str,
    end_time: str,
    description: str = "",
    color: str = "",
    location: str = "",
) -> dict:
    """Create a new calendar event."""
    return await create_event(
        title=title,
        start_time=start_time,
        end_time=end_time,
        description=description or None,
        color=color or None,
        location=location or None,
        user_id=get_current_user_id(),
    )


@mcp.tool()
async def helm_update_event(
    event_id: str,
    title: str = "",
    start_time: str = "",
    end_time: str = "",
    description: str = "",
    color: str = "",
    location: str = "",
) -> dict:
    """Update an existing calendar event."""
    return await update_event(
        event_id=event_id,
        title=title or None,
        start_time=start_time or None,
        end_time=end_time or None,
        description=description or None,
        color=color or None,
        location=location or None,
        user_id=get_current_user_id(),
    )


@mcp.tool()
async def helm_delete_event(event_id: str) -> dict:
    """Delete a calendar event."""
    return await delete_event(event_id, get_current_user_id())


@mcp.tool()
async def helm_send_notification(
    title: str,
    message: str,
    severity: str = "info",
) -> dict:
    """Send a notification to the user's app. Severity: info | warning | error | success."""
    return await send_notification(
        title=title,
        message=message,
        severity=severity,
        user_id=get_current_user_id(),
    )


@mcp.tool()
async def helm_get_chat_history(limit: int = 20) -> list:
    """Get recent chat messages."""
    return await get_chat_history(get_current_user_id(), limit)


@mcp.tool()
async def helm_send_chat_message(content: str) -> dict:
    """Send a message to the user in the chat."""
    return await send_chat_message(content, get_current_user_id())


@mcp.tool()
async def helm_update_module_state(module_type: str, state: dict) -> dict:
    """Update the UI state of a module (calendar | alerts | forms)."""
    return await update_module_state(module_type, state, get_current_user_id())


@mcp.tool()
async def helm_get_form_data(form_id: str = "") -> dict:
    """Get submitted form data."""
    return await get_form_data(form_id or None, get_current_user_id())


def get_mcp_asgi_app():
    """Return the MCP ASGI app for mounting into FastAPI."""
    return mcp.streamable_http_app
