"""Tests for keel_server.tools — SDUI normalization, component updates, and form validation."""

import pytest
from keel_server.tools import (
    normalize_sdui_screen,
    _normalize_sdui_component,
    update_component_in_screen,
    validate_form_submission,
)


# ── _normalize_sdui_component ───────────────────────────────────────────────

class TestNormalizeComponent:
    def test_flat_to_props(self):
        """Flat AI output should be wrapped into props."""
        result = _normalize_sdui_component({"type": "text", "content": "Hello"})
        assert result["props"]["content"] == "Hello"
        assert result["type"] == "text"
        assert "id" in result

    def test_already_normalized(self):
        """Component with props key should pass through unchanged."""
        comp = {"type": "Text", "id": "t1", "props": {"content": "Hi"}}
        result = _normalize_sdui_component(comp)
        assert result == comp

    def test_generates_id_if_missing(self):
        result = _normalize_sdui_component({"type": "text", "content": "Hi"})
        assert result["id"]  # non-empty string

    def test_preserves_existing_id(self):
        result = _normalize_sdui_component({"type": "text", "id": "my-id", "content": "Hi"})
        assert result["id"] == "my-id"

    def test_recursive_children(self):
        comp = {
            "type": "container",
            "children": [
                {"type": "text", "content": "Child 1"},
                {"type": "text", "content": "Child 2"},
            ],
        }
        result = _normalize_sdui_component(comp)
        assert len(result["children"]) == 2
        assert result["children"][0]["props"]["content"] == "Child 1"

    def test_non_dict_passthrough(self):
        assert _normalize_sdui_component("not a dict") == "not a dict"

    def test_missing_type_passthrough(self):
        assert _normalize_sdui_component({"content": "no type"}) == {"content": "no type"}

    def test_unknown_type_all_fields_become_props(self):
        """Unknown component types should put all non-structural fields in props."""
        result = _normalize_sdui_component({"type": "CustomWidget", "foo": 1, "bar": "baz"})
        assert result["props"]["foo"] == 1
        assert result["props"]["bar"] == "baz"


# ── normalize_sdui_screen (V2) ──────────────────────────────────────────────

class TestNormalizeScreen:
    def test_v2_normalizes_cell_content(self):
        screen = {
            "schema_version": "1.0.0",
            "module_id": "home",
            "rows": [
                {
                    "id": "r1",
                    "cells": [
                        {"id": "c1", "content": {"type": "text", "content": "Hello"}},
                    ],
                }
            ],
        }
        result = normalize_sdui_screen(screen)
        cell_content = result["rows"][0]["cells"][0]["content"]
        assert "props" in cell_content
        assert cell_content["props"]["content"] == "Hello"

    def test_v2_preserves_already_normalized(self):
        screen = {
            "rows": [
                {
                    "id": "r1",
                    "cells": [
                        {"id": "c1", "content": {"type": "Text", "id": "t1", "props": {"content": "Hi"}}},
                    ],
                }
            ],
        }
        result = normalize_sdui_screen(screen)
        assert result["rows"][0]["cells"][0]["content"]["props"]["content"] == "Hi"

    def test_v2_multiple_rows_and_cells(self):
        screen = {
            "rows": [
                {"id": "r1", "cells": [{"id": "c1", "content": {"type": "text", "content": "A"}}]},
                {"id": "r2", "cells": [{"id": "c2", "content": {"type": "button", "label": "Click"}}]},
            ],
        }
        result = normalize_sdui_screen(screen)
        assert result["rows"][0]["cells"][0]["content"]["props"]["content"] == "A"
        assert result["rows"][1]["cells"][0]["content"]["props"]["label"] == "Click"

    def test_non_dict_passthrough(self):
        assert normalize_sdui_screen("not a dict") == "not a dict"

    def test_no_rows_passthrough(self):
        """Screen without rows key should pass through unchanged."""
        screen = {"module_id": "home"}
        assert normalize_sdui_screen(screen) == screen

    def test_non_dict_row_preserved(self):
        screen = {"rows": ["not a dict"]}
        result = normalize_sdui_screen(screen)
        assert result["rows"][0] == "not a dict"

    def test_non_dict_cell_preserved(self):
        screen = {"rows": [{"id": "r1", "cells": ["not a dict"]}]}
        result = normalize_sdui_screen(screen)
        assert result["rows"][0]["cells"][0] == "not a dict"


# ── update_component_in_screen ────────────────────────────────────────────

class TestUpdateComponent:
    def _make_screen(self):
        return {
            "schema_version": "1.0.0",
            "module_id": "home",
            "rows": [
                {
                    "id": "r1",
                    "cells": [
                        {
                            "id": "c1",
                            "content": {
                                "type": "Text",
                                "id": "greeting",
                                "props": {"content": "Hello", "variant": "heading"},
                            },
                        },
                        {
                            "id": "c2",
                            "content": {
                                "type": "Button",
                                "id": "btn-1",
                                "props": {"label": "Click me", "variant": "primary"},
                            },
                        },
                    ],
                },
            ],
        }

    def test_updates_existing_props(self):
        screen = self._make_screen()
        result = update_component_in_screen(screen, "greeting", {"content": "Good morning"})
        cell = result["rows"][0]["cells"][0]["content"]
        assert cell["props"]["content"] == "Good morning"
        assert cell["props"]["variant"] == "heading"  # preserved

    def test_does_not_mutate_original(self):
        screen = self._make_screen()
        update_component_in_screen(screen, "greeting", {"content": "Changed"})
        assert screen["rows"][0]["cells"][0]["content"]["props"]["content"] == "Hello"

    def test_adds_new_props(self):
        screen = self._make_screen()
        result = update_component_in_screen(screen, "btn-1", {"disabled": True})
        btn = result["rows"][0]["cells"][1]["content"]
        assert btn["props"]["disabled"] is True
        assert btn["props"]["label"] == "Click me"

    def test_raises_for_unknown_id(self):
        screen = self._make_screen()
        with pytest.raises(ValueError, match="Component not found"):
            update_component_in_screen(screen, "nonexistent", {"content": "X"})

    def test_works_with_nested_children(self):
        screen = {
            "rows": [
                {
                    "id": "r1",
                    "cells": [
                        {
                            "id": "c1",
                            "content": {
                                "type": "Container",
                                "id": "container-1",
                                "props": {"direction": "row"},
                                "children": [
                                    {"type": "Text", "id": "nested-text", "props": {"content": "Inner"}},
                                ],
                            },
                        },
                    ],
                },
            ],
        }
        result = update_component_in_screen(screen, "nested-text", {"content": "Updated inner"})
        nested = result["rows"][0]["cells"][0]["content"]["children"][0]
        assert nested["props"]["content"] == "Updated inner"

    def test_component_without_props_key(self):
        screen = {
            "rows": [
                {
                    "id": "r1",
                    "cells": [
                        {"id": "c1", "content": {"type": "Text", "id": "bare"}},
                    ],
                },
            ],
        }
        result = update_component_in_screen(screen, "bare", {"content": "Added"})
        assert result["rows"][0]["cells"][0]["content"]["props"]["content"] == "Added"


# ── validate_form_submission ──────────────────────────────────────────────

class TestValidateFormSubmission:
    def test_valid_submission(self):
        fields = [
            {"id": "name", "type": "text", "label": "Name", "required": True},
            {"id": "email", "type": "email", "label": "Email", "required": True},
        ]
        data = {"name": "Alice", "email": "alice@example.com"}
        assert validate_form_submission(fields, data) == []

    def test_missing_required_field(self):
        fields = [
            {"id": "name", "type": "text", "label": "Name", "required": True},
        ]
        data = {"name": ""}
        errors = validate_form_submission(fields, data)
        assert len(errors) == 1
        assert "Name is required" in errors[0]

    def test_missing_required_field_absent_key(self):
        fields = [
            {"id": "name", "type": "text", "label": "Name", "required": True},
        ]
        data = {}
        errors = validate_form_submission(fields, data)
        assert len(errors) == 1

    def test_optional_field_can_be_empty(self):
        fields = [
            {"id": "notes", "type": "textarea", "label": "Notes", "required": False},
        ]
        data = {"notes": ""}
        assert validate_form_submission(fields, data) == []

    def test_invalid_select_option(self):
        fields = [
            {
                "id": "color",
                "type": "select",
                "label": "Color",
                "options": [{"label": "Red", "value": "red"}, {"label": "Blue", "value": "blue"}],
            },
        ]
        data = {"color": "green"}
        errors = validate_form_submission(fields, data)
        assert len(errors) == 1
        assert "invalid option" in errors[0]

    def test_valid_select_option(self):
        fields = [
            {
                "id": "color",
                "type": "select",
                "label": "Color",
                "options": [{"label": "Red", "value": "red"}],
            },
        ]
        data = {"color": "red"}
        assert validate_form_submission(fields, data) == []

    def test_checkbox_false_counts_as_missing_for_required(self):
        fields = [
            {"id": "agree", "type": "checkbox", "label": "I agree", "required": True},
        ]
        data = {"agree": False}
        errors = validate_form_submission(fields, data)
        assert len(errors) == 1

    def test_empty_fields_list(self):
        assert validate_form_submission([], {"anything": "value"}) == []
