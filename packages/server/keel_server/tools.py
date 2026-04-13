"""SDUI normalization utilities.

Pure functions for converting flat AI-generated SDUI JSON into the props-based
schema that the frontend TypeScript types expect. No database access.
"""

from typing import Any
from uuid import uuid4


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

    # Already has props — ensure id and recurse into children
    if 'props' in comp:
        result = {**comp, 'id': comp_id}
        if 'children' in result:
            result['children'] = [_normalize_sdui_component(c) for c in result['children']]
        return result

    # Flat format — split fields into props vs structural
    comp_type: str = comp.get('type', '')
    # Case-insensitive lookup; if type is unknown, ALL non-structural keys become props
    prop_fields = _SDUI_PROPS_FIELDS.get(comp_type) or _SDUI_PROPS_FIELDS.get(comp_type.lower())

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
        result['children'] = [_normalize_sdui_component(c) for c in comp['children']]

    return result


def normalize_sdui_screen(screen: dict[str, Any]) -> dict[str, Any]:
    """Normalize every component in an SDUIScreen to use the props-based schema.

    Called before storing and before serving SDUI screens so that flat
    AI-generated JSON always matches what the frontend TypeScript types expect.
    Expects V2 (row-based) format with rows[] → cells[] → content.
    """
    if not isinstance(screen, dict):
        return screen

    if 'rows' not in screen or not isinstance(screen.get('rows'), list):
        return screen

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
