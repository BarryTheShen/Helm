"""MCP server — exposes Helm tools to external AI agents via Streamable HTTP.

Mounted at /mcp on the FastAPI app.
Authentication: Bearer token in Authorization header.
"""

import contextvars
import json

from loguru import logger
from mcp.server.fastmcp import FastMCP
from sqlalchemy import select

from app.mcp.tools import (
    approve_draft,
    create_event,
    delete_all_events,
    delete_event,
    delete_screen,
    get_chat_history,
    get_form_data,
    get_screen,
    hide_tab,
    list_screens,
    list_tabs,
    read_all_calendar,
    read_calendar,
    send_chat_message,
    send_notification,
    set_screen,
    show_tab,
    update_event,
    update_module_state,
)

# MCP context var for user_id (set per-request by auth middleware)
_current_user_id: contextvars.ContextVar[str] = contextvars.ContextVar("_current_user_id", default="")


def get_current_user_id() -> str:
    return _current_user_id.get()


class _MCPAuthMiddleware:
    """ASGI middleware that validates Bearer session tokens before forwarding to MCP.

    FastAPI Depends() does not apply to mounted ASGI sub-apps, so we must
    handle auth at the ASGI level here.  A valid session token is required on
    every request; the resolved user_id is stored in _current_user_id so
    MCP tool handlers can retrieve it without extra DB calls.
    """

    def __init__(self, app) -> None:
        self._app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self._app(scope, receive, send)
            return

        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        auth_header = headers.get(b"authorization", b"").decode()
        token = auth_header.removeprefix("Bearer ").strip()

        user_id = await self._resolve_user_id(token) if token else None

        if not user_id:
            logger.warning("MCP request rejected: missing or invalid Bearer token")
            await self._send_401(scope, receive, send)
            return

        # Stamp context var so tool handlers can call get_current_user_id()
        _current_user_id.set(user_id)
        await self._app(scope, receive, send)

    @staticmethod
    async def _resolve_user_id(token: str) -> str | None:
        """Validate *token* against the sessions table; return user_id or None."""
        from app.database import AsyncSessionLocal
        from app.services.auth import get_session_by_token

        try:
            async with AsyncSessionLocal() as db:
                session = await get_session_by_token(db, token)
                return str(session.user_id) if session else None
        except Exception as exc:  # noqa: BLE001
            logger.error(f"MCP token validation error: {exc}")
            return None

    @staticmethod
    async def _send_401(scope, receive, send) -> None:
        if scope["type"] == "http":
            body = json.dumps({"detail": "Not authenticated"}).encode()
            await send({
                "type": "http.response.start",
                "status": 401,
                "headers": [
                    [b"content-type", b"application/json"],
                    [b"www-authenticate", b"Bearer"],
                    [b"content-length", str(len(body)).encode()],
                ],
            })
            await send({"type": "http.response.body", "body": body})


mcp = FastMCP("Helm", streamable_http_path="/")


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
    """Delete a single calendar event by ID."""
    return await delete_event(event_id, get_current_user_id())


@mcp.tool()
async def helm_delete_all_events() -> dict:
    """Delete ALL calendar events for the user in one call.

    Use this instead of calling helm_delete_event in a loop — it is far more
    efficient and avoids token explosion when the user has many events.
    Returns: {"deleted_count": N}
    """
    return await delete_all_events(get_current_user_id())


@mcp.tool()
async def helm_read_all_calendar() -> list:
    """Get every calendar event for the user across all dates.

    Use this when you need a complete view of the calendar without guessing a
    date range.  For scoped queries prefer helm_read_calendar with specific dates.
    """
    return await read_all_calendar(get_current_user_id())


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


@mcp.tool()
async def helm_set_screen(module_id: str, screen: dict | str) -> dict:
    """Set the Server-Driven UI screen for a module.

    This is the primary AI tool for building dynamic native UIs.  Generate a
    complete SDUIScreen JSON object and call this tool — the frontend re-renders
    immediately via WebSocket without any polling.

    SCHEMA (follow this exactly):
    {
      "schema_version": 1,
      "module_id": "<same as module_id arg>",
      "title": "Screen title shown in nav header",
      "generated_at": "<ISO 8601 timestamp>",
      "sections": [
        {
          "id": "unique-section-id",
          "title": "Optional section header",
          "component": <SDUIComponent>
        }
      ]
    }

    COMPONENT TYPES — use the "type" discriminant:
      text        { content, size?, bold?, italic?, color?, align? }
      heading     { content, level? (1-3), align? }
      button      { label, variant? (primary|secondary|destructive|ghost), action }
      icon_button { icon, label, action, size? }
      divider     { spacing? (sm|md|lg) }
      spacer      { size? (xs|sm|md|lg|xl) }
      card        { title?, subtitle?, elevated?, action? } + children[]
      container   { direction? (row|column), gap?, wrap?, align? } + children[]
      list        { title?, items: [{id,title,subtitle?,badge?,icon?,right_text?,action?}] }
      form        { title?, fields: [{id,type,label,...}], submit_label?, submit_action }
      alert       { severity (info|warning|error|success), title, message, dismissible? }
      badge       { label, color? (blue|green|red|yellow|gray) }
      stat        { label, value, change?, change_direction? (up|down|neutral), icon? }
      stats_row   { stats: [{label,value,change?,change_direction?}] }
      calendar    { events: [{id,title,start,end,allDay?,color?}], view? (month|day) }
      image       { uri, aspect_ratio?, alt?, action? }
      progress    { value, max?, label?, color? }

    ACTION TYPES:
      navigate   { type:"navigate", screen, params? }
      api_call   { type:"api_call", method, path, body? }
      dismiss    { type:"dismiss" }
      copy_text  { type:"copy_text", text }
      open_url   { type:"open_url", url }

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    import json as _json
    if isinstance(screen, str):
        screen = _json.loads(screen)
    return await set_screen(module_id, screen, get_current_user_id())


@mcp.tool()
async def helm_delete_screen(module_id: str) -> dict:
    """Delete the AI-generated SDUI screen for a module.

    The tab immediately returns to its empty/default state on the frontend.
    Use this to blank out a screen or reset it before setting new content.

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await delete_screen(module_id, get_current_user_id())


@mcp.tool()
async def helm_list_screens() -> dict:
    """List all SDUI screens currently set by the AI across all modules.

    Returns a list of {module_id, version, title, sections_count} for each
    module that has AI-generated content. Modules not in the list are showing
    their default/empty state.
    """
    return await list_screens(get_current_user_id())


@mcp.tool()
async def helm_get_screen(module_id: str) -> dict:
    """Get the current SDUIScreen JSON for a module (null if not yet set)."""
    return await get_screen(module_id, get_current_user_id())


@mcp.tool()
async def helm_approve_draft(module_id: str) -> dict:
    """Approve and publish a draft screen so it goes live in the mobile app.

    Call this after helm_set_screen to promote the saved draft to the live screen.
    The screen will immediately become visible to the user.

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await approve_draft(module_id, get_current_user_id())

    """Hide a tab from the bottom navigation bar.

    The tab disappears from the nav bar instantly via WebSocket.
    Tab content and data are fully preserved — use helm_show_tab to restore it.

    Valid tab_ids: home | chat | modules | calendar | forms | alerts | settings
    """
    return await hide_tab(tab_id, get_current_user_id())


@mcp.tool()
async def helm_show_tab(tab_id: str) -> dict:
    """Restore a previously hidden tab to the bottom navigation bar.

    Valid tab_ids: home | chat | modules | calendar | forms | alerts | settings
    """
    return await show_tab(tab_id, get_current_user_id())


@mcp.tool()
async def helm_list_tabs() -> dict:
    """List all app tabs and their current visibility status (visible or hidden).

    Returns a list of {id, name, icon, visible} for each tab.
    """
    return await list_tabs(get_current_user_id())


def get_mcp_asgi_app():
    """Return the MCP ASGI app (wrapped with auth middleware) for mounting into FastAPI."""
    return _MCPAuthMiddleware(mcp.streamable_http_app())
