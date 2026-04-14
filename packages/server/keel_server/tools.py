"""SDUI normalization and manipulation utilities.

Pure functions for converting flat AI-generated SDUI JSON into the props-based
schema that the frontend TypeScript types expect. Also provides helpers for
partial component updates and form submission validation. No database access.
"""

from typing import Any
from uuid import uuid4


# Fields that belong in props for each component type.
# Keys use PascalCase to match the canonical SDUIComponentType from @keel/protocol.
# The normalizer also does a case-insensitive fallback (line ~60), so AI output
# like {"type": "text", ...} still resolves correctly.
_SDUI_PROPS_FIELDS: dict[str, set[str]] = {
    # Atomic (Tier 2)
    'Text':           {'content', 'size', 'color', 'bold', 'italic', 'align', 'variant', 'underline', 'strikethrough', 'numberOfLines', 'selectable'},
    'Markdown':       {'content', 'style'},
    'Button':         {'label', 'variant', 'action', 'disabled', 'icon'},
    'Image':          {'uri', 'aspect_ratio', 'alt', 'action'},
    'TextInput':      {'placeholder', 'value', 'secure', 'keyboardType', 'multiline', 'label', 'onChangeAction'},
    'Icon':           {'name', 'size', 'color'},
    'Divider':        {'spacing'},
    # Structural (Tier 1)
    'Container':      {'direction', 'gap', 'wrap', 'align', 'justify', 'padding', 'flex', 'backgroundColor', 'borderRadius', 'shadow'},
    # Composite (Tier 3)
    'CalendarModule': {'events', 'view', 'defaultView'},
    'ChatModule':     {'threadId', 'messages'},
    'NotesModule':    {'notes'},
    'InputBar':       {'placeholder', 'action', 'value'},
    'Form':           {'title', 'fields', 'submit_label', 'submit_action'},
    'ScreenOptions':  {'options', 'title'},
}

# Lowercase lookup index so AI output like {"type": "text"} still resolves
_SDUI_PROPS_FIELDS_LOWER: dict[str, set[str]] = {
    k.lower(): v for k, v in _SDUI_PROPS_FIELDS.items()
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
    # Exact match first, then case-insensitive fallback for AI-generated lowercase types
    prop_fields = _SDUI_PROPS_FIELDS.get(comp_type) or _SDUI_PROPS_FIELDS_LOWER.get(comp_type.lower())

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


# ── Partial component update ──────────────────────────────────────────────


def _find_component_by_id(
    screen: dict[str, Any], component_id: str
) -> dict[str, Any] | None:
    """Walk a V2 screen and return the component dict matching the given id.

    Returns None if no component with that id is found. The returned dict is a
    reference into the original screen structure, so mutations to it will modify
    the screen in place.
    """
    for row in screen.get('rows', []):
        if not isinstance(row, dict):
            continue
        for cell in row.get('cells', []):
            if not isinstance(cell, dict):
                continue
            content = cell.get('content')
            if isinstance(content, dict):
                found = _search_component_tree(content, component_id)
                if found is not None:
                    return found
    return None


def _search_component_tree(
    comp: dict[str, Any], component_id: str
) -> dict[str, Any] | None:
    """Recursively search a component tree for a component with the given id."""
    if comp.get('id') == component_id:
        return comp
    for child in comp.get('children', []):
        if isinstance(child, dict):
            found = _search_component_tree(child, component_id)
            if found is not None:
                return found
    return None


def update_component_in_screen(
    screen: dict[str, Any],
    component_id: str,
    props: dict[str, Any],
) -> dict[str, Any]:
    """Apply a partial props update to a specific component within a V2 screen.

    Finds the component by id and merges the given props into its existing props
    dict. Returns a new screen dict (shallow copy at the top level). The original
    screen is not modified.

    Raises ValueError if no component with the given id is found.
    """
    import copy
    updated = copy.deepcopy(screen)
    target = _find_component_by_id(updated, component_id)
    if target is None:
        raise ValueError(f"Component not found: {component_id}")
    if 'props' not in target:
        target['props'] = {}
    target['props'].update(props)
    return updated


# ── Form submission validation ────────────────────────────────────────────


def validate_form_submission(
    fields: list[dict[str, Any]],
    data: dict[str, Any],
) -> list[str]:
    """Validate form submission data against field definitions.

    Checks that all required fields have non-empty values and that select fields
    contain valid option values. Returns a list of error messages (empty if valid).

    Args:
        fields: List of field definition dicts, each with at least 'id', 'type',
            'label', and optionally 'required' and 'options'.
        data: The submitted form data dict mapping field id to value.

    Returns:
        A list of human-readable error strings. An empty list means the
        submission is valid.
    """
    errors: list[str] = []
    for field in fields:
        field_id = field.get('id', '')
        label = field.get('label', field_id)
        required = field.get('required', False)
        value = data.get(field_id)

        if required:
            if value is None or value == '' or value is False:
                errors.append(f"{label} is required")
                continue

        if value is not None and value != '':
            # Validate select fields against allowed options
            if field.get('type') == 'select' and field.get('options'):
                valid_values = {opt['value'] for opt in field['options']}
                if value not in valid_values:
                    errors.append(f"{label}: invalid option '{value}'")

    return errors
