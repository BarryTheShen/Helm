"""Tests for keel_server.tools — SDUI normalization."""

from keel_server.tools import normalize_sdui_screen, _normalize_sdui_component


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
