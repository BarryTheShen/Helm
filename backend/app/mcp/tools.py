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
from app.services.sdui_state import (
    SDUI_MODULE_PREFIX as _SDUI_PREFIX,
    count_sdui_screen_layout_items,
    delete_module_states,
    draft_screen_key,
    live_screen_key,
    live_screen_module_type_filter,
    module_state_keys_to_clear,
    persist_live_screen,
    prepare_sdui_screen_for_storage,
    send_draft_cleared,
    send_draft_update,
    send_live_screen_update,
)


async def execute_tool(name: str, args: dict[str, Any], user_id: str) -> Any:
    """Dispatch a tool call by name."""
    handlers: dict[str, Any] = {
        "read_calendar": read_calendar,
        "read_all_calendar": read_all_calendar,
        "create_event": create_event,
        "update_event": update_event,
        "delete_event": delete_event,
        "delete_all_events": delete_all_events,
        "send_notification": send_notification,
        "get_chat_history": get_chat_history,
        "send_chat_message": send_chat_message,
        "update_module_state": update_module_state,
        "get_form_data": get_form_data,
        "set_screen": set_screen,
        "get_screen": get_screen,
        "delete_screen": delete_screen,
        "list_screens": list_screens,
        "hide_tab": hide_tab,
        "show_tab": show_tab,
        "list_tabs": list_tabs,
        "rename_tab": rename_tab,
        "approve_draft": approve_draft,
        "reject_draft": reject_draft,
        "get_draft": get_draft,
    }
    handler = handlers.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    # Prevent LLM from bypassing the draft flow by passing draft=False
    if name == "set_screen":
        args.pop("draft", None)
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
        # Refresh the SDUI calendar screen so the frontend auto-updates
        from app.routers.calendar import _update_sdui_calendar
        async with AsyncSessionLocal() as db2:
            await _update_sdui_calendar(db2, user_id)
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
        event = result.scalars().first()
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
        event = result.scalars().first()
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
        module_state = result.scalars().first()
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
        state = result.scalars().first()
        return state.state_json if state else {"forms": []}


# ── SDUI tools ─────────────────────────────────────────────────────────────
# AI-facing tool to set/get a full SDUIScreen for a module.

# Fields that belong in props for each component type (keyed by type literal)
_SDUI_PROPS_FIELDS: dict[str, set[str]] = {
    'text':        {'content', 'size', 'color', 'bold', 'italic', 'align', 'variant', 'underline', 'strikethrough', 'numberOfLines', 'selectable'},
    'heading':     {'content', 'level', 'align'},
    'button':      {'label', 'variant', 'action', 'disabled', 'icon'},
    'icon_button': {'icon', 'label', 'action', 'size'},
    'divider':     {'spacing'},
    'spacer':      {'size'},
    'card':        {'title', 'subtitle', 'elevated', 'action'},
    'container':   {'direction', 'gap', 'wrap', 'align', 'justify', 'padding', 'flex', 'backgroundColor', 'borderRadius', 'shadow'},
    'list':        {'title', 'items'},
    'form':        {'title', 'fields', 'submit_label', 'submit_action'},
    'alert':       {'severity', 'title', 'message', 'dismissible'},
    'badge':       {'label', 'color'},
    'stat':        {'label', 'value', 'change', 'change_direction', 'icon'},
    'stats_row':   {'stats'},
    'calendar':    {'events', 'view'},
    'image':       {'uri', 'aspect_ratio', 'alt', 'action'},
    'progress':    {'value', 'max', 'label', 'color'},
}

_SDUI_STRUCTURAL_KEYS = {'type', 'id', 'children', 'props'}

# V2 component types registered in the frontend componentRegistry.ts.
# MUST stay in sync with mobile/src/renderer/componentRegistry.ts — a drift
# causes valid LLM output to be rejected here (or invalid output to pass).
_VALID_V2_COMPONENT_TYPES: frozenset[str] = frozenset({
    "Text", "Markdown", "Button", "Image", "TextInput",
    "Icon", "Divider", "Container",
    "CalendarModule", "ChatModule", "NotesModule", "InputBar",
    "Badge", "Stat", "List", "Alert",
    "Todo", "RichText", "ArticleCard",
})

_LEGACY_V2_TYPE_MAP: dict[str, str] = {
    "Calendar": "CalendarModule",
    "Chat": "ChatModule",
    "Notes": "NotesModule",
    "calendar": "CalendarModule",
    "chat": "ChatModule",
    "notes": "NotesModule",
    "text": "Text",
    "markdown": "Markdown",
    "button": "Button",
    "image": "Image",
    "textinput": "TextInput",
    "text_input": "TextInput",
    "icon": "Icon",
    "divider": "Divider",
    "container": "Container",
    "inputbar": "InputBar",
    "input_bar": "InputBar",
    "badge": "Badge",
    "stat": "Stat",
    "list": "List",
    "alert": "Alert",
    "RichTextRenderer": "RichText",
}


def _normalize_sdui_type(type_name: Any) -> Any:
    if not isinstance(type_name, str):
        return type_name
    return _LEGACY_V2_TYPE_MAP.get(type_name, type_name)


def _validate_sdui_v2_container_children(
    container: dict[str, Any],
    errors: list[str],
) -> None:
    """Recursively validate nested Container descendants in V2 payloads."""
    container_id = container.get("id", "unknown")
    children = container.get("children")
    if not isinstance(children, list):
        return

    for child_idx, child in enumerate(children):
        if not isinstance(child, dict):
            continue

        child_type = child.get("type", "")
        if not child_type:
            # A typeless child reaches the mobile renderer as the red 'Invalid
            # component' box. Reject at the storage boundary so the LLM can self-correct.
            child_id = child.get("id", f"index {child_idx}")
            errors.append(
                f"Container '{container_id}' child '{child_id}' is missing required "
                f"'type' field. Every component must have a 'type' such as Text, Button, "
                f"Container. Valid types: {', '.join(sorted(_VALID_V2_COMPONENT_TYPES))}"
            )
            continue

        if child_type not in _VALID_V2_COMPONENT_TYPES:
            errors.append(
                f"Unknown child component type '{child_type}' inside Container "
                f"'{container_id}'. "
                f"Valid types: {', '.join(sorted(_VALID_V2_COMPONENT_TYPES))}"
            )
            continue

        if child_type == "Container":
            _validate_sdui_v2_container_children(child, errors)


def _validate_sdui_v2(screen: dict[str, Any]) -> list[str]:
    """Return a list of validation error strings for a V2 SDUIPage.

    Returns an empty list if the screen is valid.
    Checks: required top-level fields, row/cell structure, and component types.
    """
    errors: list[str] = []

    if not isinstance(screen.get("rows"), list):
        errors.append("Missing or invalid 'rows' field — V2 requires rows: [...]")
        return errors

    for row_idx, row in enumerate(screen["rows"]):
        if not isinstance(row, dict):
            errors.append(f"Row {row_idx} is not an object")
            continue
        if not row.get("id"):
            errors.append(f"Row {row_idx} missing 'id'")
        cells = row.get("cells")
        if not isinstance(cells, list):
            errors.append(f"Row '{row.get('id', row_idx)}' missing 'cells' list")
            continue
        for cell_idx, cell in enumerate(cells):
            if not isinstance(cell, dict):
                errors.append(f"Row '{row.get('id', row_idx)}' cell {cell_idx} is not an object")
                continue
            if not cell.get("id"):
                errors.append(f"Row '{row.get('id', row_idx)}' cell {cell_idx} missing 'id'")
            content = cell.get("content")
            if not isinstance(content, dict):
                errors.append(f"Cell '{cell.get('id', cell_idx)}' missing 'content' object")
                continue
            comp_type = content.get("type", "")
            if not comp_type:
                # A typeless content object reaches the mobile renderer as the red
                # 'Invalid component' box. Reject at the storage boundary so the LLM
                # can self-correct rather than silently shipping broken UI.
                errors.append(
                    f"Cell '{cell.get('id', cell_idx)}' content is missing required "
                    f"'type' field. Every component must have a 'type' such as Text, Button, "
                    f"Container. Valid types: {', '.join(sorted(_VALID_V2_COMPONENT_TYPES))}"
                )
                continue
            if comp_type not in _VALID_V2_COMPONENT_TYPES:
                errors.append(
                    f"Unknown component type '{comp_type}' in cell '{cell.get('id', cell_idx)}'. "
                    f"Valid types: {', '.join(sorted(_VALID_V2_COMPONENT_TYPES))}"
                )
            if comp_type == "Container":
                _validate_sdui_v2_container_children(content, errors)
    return errors


def _normalize_sdui_component(comp: dict[str, Any]) -> dict[str, Any]:
    """Convert a flat AI-generated component to the props-based schema the frontend expects.

    AI models sometimes generate: {"type": "text", "content": "Hello"}
    The frontend TypeScript types require: {"type": "text", "id": "...", "props": {"content": "Hello"}}

    If the component already has a 'props' key it is returned unchanged (children still
    recursed). Unknown fields are left at the top level to remain forward-compatible.
    """
    if not isinstance(comp, dict) or 'type' not in comp:
        return comp

    comp_id = comp.get('id') or str(uuid4())
    comp_type = _normalize_sdui_type(comp.get('type', ''))

    # Already has props — ensure id and recurse into children.
    # Preserve typeless children (don't filter them out) so validation can surface
    # an actionable error instead of silently dropping the LLM's intended content.
    if 'props' in comp:
        result = {**comp, 'type': comp_type, 'id': comp_id}
        if 'children' in result:
            result['children'] = [_normalize_sdui_component(c) for c in result['children'] if isinstance(c, dict)]
        return result

    # Flat format — split fields into props vs structural
    # Case-insensitive lookup; if type is unknown, ALL non-structural keys become props
    prop_fields = (
        _SDUI_PROPS_FIELDS.get(comp_type)
        or _SDUI_PROPS_FIELDS.get(str(comp_type).lower())
        or _SDUI_PROPS_FIELDS.get(comp.get('type', ''))
        or _SDUI_PROPS_FIELDS.get(str(comp.get('type', '')).lower())
    )

    props: dict[str, Any] = {}
    rest: dict[str, Any] = {}
    for key, val in comp.items():
        if key in _SDUI_STRUCTURAL_KEYS:
            continue
        elif prop_fields is None or key in prop_fields:
            # Unknown types: everything goes in props (be liberal)
            props[key] = val
        else:
            rest[key] = val  # unexpected fields preserved at top level

    result = {'type': comp_type, 'id': comp_id, 'props': props, **rest}

    if 'children' in comp:
        # Preserve typeless children so validation can surface an actionable error
        # instead of silently dropping the LLM's intended content.
        result['children'] = [_normalize_sdui_component(c) for c in comp['children'] if isinstance(c, dict)]

    return result


def normalize_sdui_screen(
    screen: dict[str, Any],
    *,
    convert_legacy_sections: bool = True,
) -> dict[str, Any]:
    """Normalize every component in an SDUIScreen to use the props-based schema.

    Called before storing and before serving SDUI screens so that flat
    AI-generated JSON always matches what the frontend TypeScript types expect.
    Handles both V1 (section-based) and V2 (row-based) formats. When
    convert_legacy_sections is True, legacy V1 sections are returned as V2 rows.
    """
    if not isinstance(screen, dict):
        return screen

    # V2: row-based format — normalize each cell's content component
    if 'rows' in screen and isinstance(screen.get('rows'), list):
        normalized_rows = []
        for row in screen['rows']:
            if not isinstance(row, dict):
                normalized_rows.append(row)
                continue
            norm_row = dict(row)
            if 'cells' in norm_row and isinstance(norm_row['cells'], list):
                norm_cells = []
                for cell in norm_row['cells']:
                    if not isinstance(cell, dict):
                        norm_cells.append(cell)
                        continue
                    norm_cell = dict(cell)
                    if 'content' in norm_cell and isinstance(norm_cell['content'], dict):
                        norm_cell['content'] = _normalize_sdui_component(norm_cell['content'])
                    norm_cells.append(norm_cell)
                norm_row['cells'] = norm_cells
            normalized_rows.append(norm_row)
        return {**screen, 'rows': normalized_rows}

    # V1: section-based format
    normalized_sections = []
    normalized_rows = []
    for section_index, section in enumerate(screen.get('sections', [])):
        if not isinstance(section, dict):
            normalized_sections.append(section)
            continue

        norm_section = dict(section)
        section_components: list[dict[str, Any]] = []
        if 'component' in norm_section and isinstance(norm_section['component'], dict):
            normalized_component = _normalize_sdui_component(norm_section['component'])
            norm_section['component'] = normalized_component
            section_components.append(normalized_component)
        if 'components' in norm_section:
            normalized_components = [
                _normalize_sdui_component(component)
                for component in norm_section['components']
                if isinstance(component, dict)
            ]
            norm_section['components'] = normalized_components
            section_components.extend(normalized_components)
        normalized_sections.append(norm_section)

        row = {
            key: value
            for key, value in norm_section.items()
            if key not in {'component', 'components'}
        }
        row.setdefault('id', f'row-{section_index}')
        row.setdefault('height', 'auto')
        row['cells'] = [
            {
                'id': f"{row['id']}-cell-{component_index}",
                'width': 1,
                'content': component,
            }
            for component_index, component in enumerate(section_components)
        ]
        normalized_rows.append(row)

    if convert_legacy_sections:
        screen_meta = {key: value for key, value in screen.items() if key != 'sections'}
        return {**screen_meta, 'rows': normalized_rows}

    return {**screen, 'sections': normalized_sections}


async def set_screen(module_id: str, screen: dict[str, Any], user_id: str, draft: bool = True) -> dict[str, Any]:
    """Persist an SDUIScreen JSON for *module_id*.

    Architecture Decision: Session 2, Section 8 — Draft/Approval Flow.
    When draft=True (default), the screen is saved as a draft. The frontend
    shows a preview with approve/reject options. When approved, the draft
    becomes the live screen.

    The screen must follow the SDUIScreen schema:
      { schema_version: 1, module_id, title, sections: [...] }
    """
    screen = prepare_sdui_screen_for_storage(screen, module_id)

    if draft:
        # Store as draft, don't overwrite live screen
        draft_key = draft_screen_key(module_id)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ModuleState).where(
                    ModuleState.user_id == user_id,
                    ModuleState.module_type == draft_key,
                )
            )
            state = result.scalars().first()
            if state is None:
                state = ModuleState(
                    id=str(uuid4()),
                    user_id=user_id,
                    module_type=draft_key,
                    state_json=screen,
                    version=1,
                )
                db.add(state)
            else:
                state.state_json = screen
                state.version += 1
            await db.commit()
            version = state.version

        await send_draft_update(user_id, module_id, screen, version)
        return {"module_id": module_id, "version": version, "draft": True, "message": "Screen saved as draft. User must approve to go live."}
    else:
        # Direct publish (for auto-approval or programmatic use)
        return await _publish_screen(module_id, screen, user_id)


async def _publish_screen(module_id: str, screen: dict[str, Any], user_id: str) -> dict[str, Any]:
    """Directly publish a screen (bypasses draft flow)."""
    async with AsyncSessionLocal() as db:
        version, cleared_existing_draft = await persist_live_screen(
            db,
            user_id=user_id,
            module_id=module_id,
            screen=screen,
        )
        await db.commit()

    if cleared_existing_draft:
        await send_draft_cleared(user_id, module_id)
    await send_live_screen_update(user_id, module_id, screen, version)
    return {"module_id": module_id, "version": version, "updated": True}


async def get_screen(module_id: str, user_id: str) -> dict[str, Any]:
    """Return the current SDUIScreen JSON for *module_id*, or null if not yet set."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == live_screen_key(module_id),
            )
        )
        state = result.scalars().first()
    if state is None:
        return {"screen": None}
    return {"screen": state.state_json, "version": state.version}


async def delete_screen(module_id: str, user_id: str) -> dict[str, Any]:
    """Delete the SDUI screen for *module_id*, returning the tab to its empty state."""
    async with AsyncSessionLocal() as db:
        deleted_types = await delete_module_states(db, user_id, module_state_keys_to_clear(module_id))
        if deleted_types:
            await db.commit()

    await send_draft_cleared(user_id, module_id)
    await send_live_screen_update(user_id, module_id, None, 0)
    return {"module_id": module_id, "deleted": True}


async def list_screens(user_id: str) -> dict[str, Any]:
    """List all SDUI screens the AI has set, across all modules."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                live_screen_module_type_filter(ModuleState.module_type),
            )
        )
        states = result.scalars().all()
    return {
        "screens": [
            {
                "module_id": s.module_type.removeprefix(_SDUI_PREFIX),
                "version": s.version,
                "title": (s.state_json or {}).get("title", ""),
                "sections_count": count_sdui_screen_layout_items(s.state_json),
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
    cfg = await _get_tabs_config_for_user(user_id)
    return cfg["hidden_tabs"]


async def _get_tabs_config_for_user(user_id: str) -> dict:
    """Return the full tabs config (hidden_tabs + tab_overrides) for a user."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == _TABS_CONFIG_KEY,
            )
        )
        state = result.scalars().first()
    if state is None:
        return {"hidden_tabs": [], "tab_overrides": {}}
    cfg = state.state_json or {}
    cfg.setdefault("hidden_tabs", [])
    cfg.setdefault("tab_overrides", {})
    return cfg


async def _save_tabs_config_for_user(user_id: str, config: dict) -> None:
    """Persist the full tabs config for a user (hidden_tabs + tab_overrides)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == _TABS_CONFIG_KEY,
            )
        )
        state = result.scalars().first()
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


async def _set_hidden_tabs_for_user(user_id: str, hidden_tabs: list[str]) -> None:
    config = await _get_tabs_config_for_user(user_id)
    config["hidden_tabs"] = hidden_tabs
    await _save_tabs_config_for_user(user_id, config)


def _apply_overrides(hidden: list[str], overrides: dict) -> list[dict]:
    """Build the module list applying per-user name/icon overrides and visibility."""
    return [
        {
            "id": t["id"],
            "name": overrides.get(t["id"], {}).get("name", t["name"]),
            "icon": overrides.get(t["id"], {}).get("icon", t["icon"]),
            "enabled": t["id"] not in hidden,
        }
        for t in _ALL_TAB_DETAILS
    ]


async def hide_tab(tab_id: str, user_id: str) -> dict[str, Any]:
    """Hide a tab from the bottom nav bar.  Content and data are preserved."""
    from app.services.websocket_manager import manager

    if tab_id not in _ALL_TAB_IDS:
        raise ValueError(f"Unknown tab '{tab_id}'. Valid tabs: {', '.join(_ALL_TAB_IDS)}")

    hidden = await _get_hidden_tabs_for_user(user_id)
    if tab_id not in hidden:
        hidden = hidden + [tab_id]
        await _set_hidden_tabs_for_user(user_id, hidden)

    overrides = (await _get_tabs_config_for_user(user_id))["tab_overrides"]
    modules = _apply_overrides(hidden, overrides)
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

    overrides = (await _get_tabs_config_for_user(user_id))["tab_overrides"]
    modules = _apply_overrides(hidden, overrides)
    await manager.send(user_id, {"type": "tabs_updated", "modules": modules})
    return {"tab_id": tab_id, "hidden": False, "message": f"'{tab_id}' tab is now visible in navigation."}


async def list_tabs(user_id: str) -> dict[str, Any]:
    """List all tabs and their current visibility status, names, and icons."""
    cfg = await _get_tabs_config_for_user(user_id)
    hidden = cfg["hidden_tabs"]
    overrides = cfg["tab_overrides"]
    tabs = [
        {
            "id": t["id"],
            "name": overrides.get(t["id"], {}).get("name", t["name"]),
            "icon": overrides.get(t["id"], {}).get("icon", t["icon"]),
            "visible": t["id"] not in hidden,
        }
        for t in _ALL_TAB_DETAILS
    ]
    return {"tabs": tabs}


async def rename_tab(
    tab_id: str,
    user_id: str,
    name: str | None = None,
    icon: str | None = None,
) -> dict[str, Any]:
    """Rename a navigation tab and/or change its icon.

    Use this to give tabs meaningful custom names — e.g. rename 'forms' to
    'Tokyo Trip Dashboard' or change 'modules' to '🗾 Japan Itinerary'.

    Args:
        tab_id: The tab to rename (home/chat/modules/calendar/forms/alerts/settings)
        name:   New display label, e.g. "Tokyo Trip Dashboard"
        icon:   New emoji icon, e.g. "🗾"
    """
    from app.services.websocket_manager import manager

    if tab_id not in _ALL_TAB_IDS:
        raise ValueError(f"Unknown tab '{tab_id}'. Valid tabs: {', '.join(_ALL_TAB_IDS)}")
    if name is None and icon is None:
        raise ValueError("Provide at least one of: name, icon")

    cfg = await _get_tabs_config_for_user(user_id)
    override = cfg["tab_overrides"].get(tab_id, {})
    if name is not None:
        override["name"] = name
    if icon is not None:
        override["icon"] = icon
    cfg["tab_overrides"][tab_id] = override
    await _save_tabs_config_for_user(user_id, cfg)

    modules = _apply_overrides(cfg["hidden_tabs"], cfg["tab_overrides"])
    await manager.send(user_id, {"type": "tabs_updated", "modules": modules})
    display_name = override.get("name") or tab_id
    return {"tab_id": tab_id, "name": override.get("name"), "icon": override.get("icon"), "message": f"Tab '{tab_id}' renamed to '{display_name}'."}


# ── Draft management (Human-in-the-Loop) ──────────────────────────────────
# Architecture Decision: Session 2, Section 8.
# AI layout changes go through approval. Draft screens are stored separately.

async def approve_draft(module_id: str, user_id: str) -> dict[str, Any]:
    """Approve a draft screen — promote it to the live screen."""
    draft_key = draft_screen_key(module_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == draft_key,
            )
        )
        draft = result.scalars().first()
        if draft is None:
            return {"status": "error", "message": f"No draft found for module '{module_id}'"}

        screen = draft.state_json

        # Delete the draft
        await db.delete(draft)

        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == live_screen_key(module_id),
            )
        )
        live_state = result.scalars().first()
        if live_state is None:
            live_state = ModuleState(
                id=str(uuid4()),
                user_id=user_id,
                module_type=live_screen_key(module_id),
                state_json=screen,
                version=1,
            )
            db.add(live_state)
        else:
            live_state.state_json = screen
            live_state.version += 1

        await db.commit()
        version = live_state.version

    await send_draft_cleared(user_id, module_id)
    await send_live_screen_update(user_id, module_id, screen, version)
    return {"module_id": module_id, "version": version, "approved": True}


async def reject_draft(module_id: str, user_id: str, feedback: str | None = None) -> dict[str, Any]:
    """Reject a draft screen — discard it and optionally provide feedback."""
    draft_key = draft_screen_key(module_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == draft_key,
            )
        )
        draft = result.scalars().first()
        if draft is None:
            return {"status": "error", "message": f"No draft found for module '{module_id}'"}

        await db.delete(draft)
        await db.commit()

    await send_draft_cleared(user_id, module_id)

    response: dict[str, Any] = {"module_id": module_id, "rejected": True}
    if feedback:
        response["feedback"] = feedback
        response["message"] = f"Draft rejected. User feedback: {feedback}"
    else:
        response["message"] = "Draft rejected by user."
    return response


async def get_draft(module_id: str, user_id: str) -> dict[str, Any]:
    """Get the current draft screen for a module, if any."""
    draft_key = draft_screen_key(module_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == draft_key,
            )
        )
        draft = result.scalars().first()

    if draft is None:
        return {"screen": None, "has_draft": False}
    return {"screen": draft.state_json, "version": draft.version, "has_draft": True}
