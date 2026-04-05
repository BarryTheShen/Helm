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
    get_draft,
    get_form_data,
    get_screen,
    hide_tab,
    list_screens,
    list_tabs,
    read_all_calendar,
    read_calendar,
    reject_draft,
    rename_tab,
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


# ── Calendar tools ─────────────────────────────────────────────────────────

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
    """Create a new calendar event.

    Times are ISO 8601 format: 2026-04-02T09:00:00
    Color is optional hex or named color (e.g. #3B82F6 or "blue").
    """
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
    """Update an existing calendar event. Only pass fields you want to change."""
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


# ── Notification & chat tools ──────────────────────────────────────────────

@mcp.tool()
async def helm_send_notification(
    title: str,
    message: str,
    severity: str = "info",
) -> dict:
    """Send a push notification to the user's app.

    severity: info | warning | error | success
    The notification appears immediately via WebSocket and is also persisted.
    """
    return await send_notification(
        title=title,
        message=message,
        severity=severity,
        user_id=get_current_user_id(),
    )


@mcp.tool()
async def helm_get_chat_history(limit: int = 20) -> list:
    """Get the most recent chat messages (newest last).

    limit: number of messages to return (default 20, max ~100 for context budget).
    """
    return await get_chat_history(get_current_user_id(), limit)


@mcp.tool()
async def helm_send_chat_message(content: str) -> dict:
    """Send a chat message to the user that appears in their chat tab.

    The message is sent as an assistant message and persisted.
    Use for proactive updates, summaries, or confirmations.
    """
    return await send_chat_message(content, get_current_user_id())


# ── Module state & forms ───────────────────────────────────────────────────

@mcp.tool()
async def helm_update_module_state(module_type: str, state: dict) -> dict:
    """Update the UI state of a module (calendar | alerts | forms).

    Pushes state over WebSocket immediately — no page reload needed.
    """
    return await update_module_state(module_type, state, get_current_user_id())


@mcp.tool()
async def helm_get_form_data(form_id: str = "") -> dict:
    """Get submitted form data. Leave form_id empty to get all forms."""
    return await get_form_data(form_id or None, get_current_user_id())


# ── SDUI screen tools ──────────────────────────────────────────────────────

@mcp.tool()
async def helm_set_screen(module_id: str, screen: dict | str) -> dict:
    """Set a Server-Driven UI screen for a module. Frontend re-renders instantly via WebSocket.

    Screens are saved as DRAFTS by default.
    Always call helm_approve_draft(module_id) after this to publish the screen live.
    Or use helm_reject_draft(module_id) to discard it.

    ── SCHEMA (V2 — row-by-row) ───────────────────────────────────────────────
    {
      "schema_version": "1.0.0",
      "module_id": "<same as module_id arg>",
      "title": "Screen title",
      "generated_at": "<ISO 8601 timestamp — e.g. 2026-04-02T12:00:00Z>",
      "rows": [
        {
          "id": "row-id",
          "cells": [{"id": "cell-id", "width": <0.0-1.0 | "auto">, "content": <Component>}],
          "compact": {"stack": true},
          "regular": {},
          "scrollable": false,
          "gap": 12
        }
      ]
    }

    ── COMPONENT CATALOG (PascalCase ONLY) ────────────────────────────────────
    Atomic — leaf nodes, no children:
      Text        props: content*, variant?(heading|body|caption), color?, bold?, italic?, align?, numberOfLines?
      Markdown    props: content*
      Button      props: label?, icon?, iconPosition?(left|right), variant?(primary|secondary|ghost|destructive), size?(sm|md|lg), fullWidth?, onPress*:Action, disabled?, loading?
      Image       props: src*, alt?, resizeMode?(cover|contain|stretch), aspectRatio*, width?, height?, borderRadius?, placeholder?
      TextInput   props: value?, placeholder?, multiline?, maxLines?
      Icon        props: name* (feather icon), size?, color?
      Divider     props: direction?(horizontal|vertical), thickness?, color?, indent?

    Structural — has children[]:
      Container   props: direction?(row|column), gap?, padding?, backgroundColor?, borderRadius?, shadow?(sm|md|lg), flex?, align?, justify?
                  children: [Component, ...]  ← ONLY Container has children

    Composite — black-box leaf nodes (never nest composites inside each other):
      CalendarModule  props: events*:[{id,title,start,end,color?}], defaultView?(month|threeDay)
      ChatModule      props: {}
      NotesModule     props: {}
      InputBar        props: onSend*:Action, placeholder?, settingsItems?, maxLines?

    ── ACTION TYPES ───────────────────────────────────────────────────────────
      {"type": "navigate", "screen": "<module_id>", "params"?: {}}
      {"type": "server_action", "function": "<registered_name>", "params"?: {}}
      {"type": "dismiss"}
      {"type": "copy_text", "text": "..."}
      {"type": "open_url", "url": "https://..."}

    ── RESPONSIVE LAYOUT ──────────────────────────────────────────────────────
      compact (phone, <768px): {"stack": true} → cells stack vertically
      regular (tablet, ≥768px): {} → cells are side-by-side
      compact/regular: {"hidden": true} → hide row at that breakpoint
      Breakpoint: width >= 768px = regular, < 768px = compact

    ── COMMON FEATHER ICONS ───────────────────────────────────────────────────
      home, calendar, message-circle, bell, settings, user, search, plus, minus,
      check, x, arrow-left, arrow-right, chevron-down, chevron-up, edit, trash-2,
      star, heart, bookmark, clock, map-pin, phone, mail, file-text, refresh-cw,
      info, alert-triangle, eye, lock, zap, download, upload, camera, image

    ── NEVER DO THESE ─────────────────────────────────────────────────────────
      ✗ Use lowercase type names (text, button) — V2 uses PascalCase only
      ✗ Omit "id" on any row, cell, or component
      ✗ Omit "schema_version": "1.0.0"
      ✗ Omit "generated_at" timestamp
      ✗ Nest CalendarModule/ChatModule/NotesModule/InputBar inside each other
      ✗ Use Image without aspectRatio — layouts blow out without it
      ✗ Generate more than 10 rows — use scrollable:true on rows if needed
      ✗ Use a component type not listed above — unknown types render blank

    ── EXAMPLE 1: Welcome screen with two action buttons ──────────────────────
    {
      "schema_version": "1.0.0",
      "module_id": "home",
      "title": "Home",
      "generated_at": "2026-04-02T12:00:00Z",
      "rows": [
        {
          "id": "greeting",
          "cells": [{"id": "greet-cell", "width": "auto", "content": {
            "type": "Text", "id": "greet", "props": {"content": "Good morning! 👋", "variant": "heading"}
          }}]
        },
        {
          "id": "actions",
          "gap": 12,
          "compact": {"stack": true},
          "regular": {},
          "cells": [
            {"id": "cal-btn", "width": 0.5, "content": {
              "type": "Button", "id": "btn-cal",
              "props": {"label": "Calendar", "icon": "calendar", "variant": "secondary", "onPress": {"type": "navigate", "screen": "calendar"}}
            }},
            {"id": "chat-btn", "width": 0.5, "content": {
              "type": "Button", "id": "btn-chat",
              "props": {"label": "Chat", "icon": "message-circle", "variant": "primary", "onPress": {"type": "navigate", "screen": "chat"}}
            }}
          ]
        }
      ]
    }

    ── EXAMPLE 2: Full-page calendar ──────────────────────────────────────────
    {
      "schema_version": "1.0.0",
      "module_id": "calendar",
      "title": "My Calendar",
      "generated_at": "2026-04-02T12:00:00Z",
      "rows": [
        {
          "id": "calendar-row",
          "cells": [{"id": "cal-cell", "width": "auto", "content": {
            "type": "CalendarModule", "id": "main-cal",
            "props": {
              "defaultView": "month",
              "events": [
                {"id": "evt-standup", "title": "Team Standup", "start": "2026-04-02T09:00:00", "end": "2026-04-02T09:30:00", "color": "#3B82F6"}
              ]
            }
          }}]
        }
      ]
    }

    ── EXAMPLE 3: Dashboard with calendar + notes side by side ────────────────
    {
      "schema_version": "1.0.0",
      "module_id": "home",
      "title": "Dashboard",
      "generated_at": "2026-04-02T12:00:00Z",
      "rows": [
        {
          "id": "title-row",
          "cells": [{"id": "title-cell", "width": "auto", "content": {
            "type": "Text", "id": "title-text",
            "props": {"content": "My Dashboard", "variant": "heading", "bold": true}
          }}]
        },
        {
          "id": "modules-row",
          "gap": 16,
          "compact": {"stack": true},
          "regular": {},
          "cells": [
            {"id": "cal-cell", "width": 0.5, "content": {
              "type": "CalendarModule", "id": "cal",
              "props": {"defaultView": "month", "events": []}
            }},
            {"id": "notes-cell", "width": 0.5, "content": {
              "type": "NotesModule", "id": "notes", "props": {}
            }}
          ]
        }
      ]
    }

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    import json as _json
    if isinstance(screen, str):
        try:
            screen = _json.loads(screen)
        except _json.JSONDecodeError:
            from json_repair import repair_json
            repaired = repair_json(screen, return_objects=True)
            if isinstance(repaired, dict):
                screen = repaired
            else:
                raise
    return await set_screen(module_id, screen, get_current_user_id(), draft=True)


@mcp.tool()
async def helm_delete_screen(module_id: str) -> dict:
    """Delete the AI-generated SDUI screen for a module.

    The tab immediately returns to its empty/default state on the frontend.
    Use this to blank out a screen or reset it before setting entirely new content.

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await delete_screen(module_id, get_current_user_id())


@mcp.tool()
async def helm_list_screens() -> dict:
    """List all SDUI screens currently set by the AI across all modules.

    Returns a list of {module_id, version, title} for each module that has
    AI-generated content. Modules not in the list show their default/empty state.
    """
    return await list_screens(get_current_user_id())


@mcp.tool()
async def helm_get_screen(module_id: str) -> dict:
    """Get the current live SDUI screen JSON for a module.

    Returns {"screen": <SDUIPage> | null, "version": N}.
    Use helm_get_draft to inspect a pending draft instead.

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await get_screen(module_id, get_current_user_id())


@mcp.tool()
async def helm_get_draft(module_id: str) -> dict:
    """Get the pending draft SDUI screen for a module, if any.

    Returns {"screen": <SDUIPage>, "version": N, "has_draft": true} or
    {"screen": null, "has_draft": false} if no draft is pending.

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await get_draft(module_id, get_current_user_id())


@mcp.tool()
async def helm_approve_draft(module_id: str) -> dict:
    """Approve and publish a draft screen so it goes live in the mobile app.

    Call this after helm_set_screen to promote the saved draft to the live screen.
    The screen becomes visible to the user immediately via WebSocket.

    Workflow: helm_set_screen → helm_approve_draft

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await approve_draft(module_id, get_current_user_id())


@mcp.tool()
async def helm_reject_draft(module_id: str, feedback: str = "") -> dict:
    """Reject and discard a pending draft screen.

    The draft is deleted and the frontend clears the preview.
    Optionally include feedback explaining why the draft was rejected —
    useful when a user rejects a draft and you want to record their reason.

    Available module_ids: home | chat | calendar | forms | alerts | modules | settings
    """
    return await reject_draft(module_id, get_current_user_id(), feedback or None)


# ── Tab management tools ───────────────────────────────────────────────────

@mcp.tool()
async def helm_hide_tab(tab_id: str) -> dict:
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
async def helm_rename_tab(tab_id: str, name: str = "", icon: str = "") -> dict:
    """Rename a navigation tab and/or change its emoji icon.

    Use this to give tabs meaningful custom names — e.g. rename 'forms' to
    'Tokyo Trip Dashboard' or set 'modules' to '🗾 Japan Itinerary'.
    Changes are applied immediately via WebSocket.

    tab_id: home | chat | modules | calendar | forms | alerts | settings
    name:   New display label, e.g. "Trip Planner"
    icon:   New emoji icon, e.g. "✈️"
    Provide at least one of name or icon.
    """
    return await rename_tab(tab_id, get_current_user_id(), name or None, icon or None)


@mcp.tool()
async def helm_list_tabs() -> dict:
    """List all app tabs, their current visibility, names, and icons.

    Returns a list of {id, name, icon, visible} for each tab.
    Use this to inspect the current navigation state before making changes.
    """
    return await list_tabs(get_current_user_id())


def get_mcp_asgi_app():
    """Return the MCP ASGI app (wrapped with auth middleware) for mounting into FastAPI."""
    return _MCPAuthMiddleware(mcp.streamable_http_app())
