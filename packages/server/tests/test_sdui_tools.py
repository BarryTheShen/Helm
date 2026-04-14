"""Tests for keel_server.sdui_tools — pre-built MCP tools and InMemoryScreenStore."""

import pytest
from unittest.mock import patch
from keel_server.sdui_tools import InMemoryScreenStore, register_sdui_tools


# ── InMemoryScreenStore ────────────────────────────────────────────────────


class TestInMemoryScreenStore:
    @pytest.mark.asyncio
    async def test_save_and_get(self):
        store = InMemoryScreenStore()
        screen = {"module_id": "home", "rows": []}
        await store.save_screen("user1", "home", screen)
        result = await store.get_screen("user1", "home")
        assert result == screen

    @pytest.mark.asyncio
    async def test_get_returns_none_for_missing(self):
        store = InMemoryScreenStore()
        result = await store.get_screen("user1", "nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_save_overwrites(self):
        store = InMemoryScreenStore()
        await store.save_screen("user1", "home", {"rows": [], "version": 1})
        await store.save_screen("user1", "home", {"rows": [], "version": 2})
        result = await store.get_screen("user1", "home")
        assert result["version"] == 2

    @pytest.mark.asyncio
    async def test_list_screens(self):
        store = InMemoryScreenStore()
        await store.save_screen("user1", "home", {"rows": []})
        await store.save_screen("user1", "settings", {"rows": []})
        await store.save_screen("user2", "profile", {"rows": []})
        result = await store.list_screens("user1")
        assert sorted(result) == ["home", "settings"]

    @pytest.mark.asyncio
    async def test_list_screens_empty(self):
        store = InMemoryScreenStore()
        result = await store.list_screens("user1")
        assert result == []

    @pytest.mark.asyncio
    async def test_isolation_between_users(self):
        store = InMemoryScreenStore()
        await store.save_screen("user1", "home", {"rows": [], "owner": "user1"})
        await store.save_screen("user2", "home", {"rows": [], "owner": "user2"})
        r1 = await store.get_screen("user1", "home")
        r2 = await store.get_screen("user2", "home")
        assert r1["owner"] == "user1"
        assert r2["owner"] == "user2"


# ── MCP tool functions (extracted via register_sdui_tools) ─────────────────

# We test the tool functions by calling them directly after registration.
# We mock get_current_user_id() since there's no real MCP request context.


class FakeMCP:
    """Minimal stand-in for FastMCP that captures registered tools."""

    def __init__(self):
        self.tools: dict[str, callable] = {}

    def tool(self):
        def decorator(fn):
            self.tools[fn.__name__] = fn
            return fn
        return decorator


class TestRegisteredTools:
    def _setup(self):
        mcp = FakeMCP()
        store = InMemoryScreenStore()
        register_sdui_tools(mcp, store)
        return mcp, store

    @pytest.mark.asyncio
    async def test_render_screen_normalizes_and_stores(self):
        mcp, store = self._setup()
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            result = await mcp.tools["render_screen"](
                module_id="home",
                title="Dashboard",
                rows=[{
                    "id": "r1",
                    "cells": [{
                        "id": "c1",
                        "content": {"type": "text", "content": "Hello"},
                    }],
                }],
            )
        # Should be normalized (content moved into props)
        cell_content = result["rows"][0]["cells"][0]["content"]
        assert "props" in cell_content
        assert cell_content["props"]["content"] == "Hello"
        # Should be stored
        stored = await store.get_screen("u1", "home")
        assert stored == result

    @pytest.mark.asyncio
    async def test_render_screen_default_schema_version(self):
        mcp, store = self._setup()
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            result = await mcp.tools["render_screen"](
                module_id="test", title="Test", rows=[],
            )
        assert result["schema_version"] == "1.0.0"

    @pytest.mark.asyncio
    async def test_get_screen_returns_stored(self):
        mcp, store = self._setup()
        screen = {"module_id": "home", "rows": [], "title": "Home"}
        await store.save_screen("u1", "home", screen)
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            result = await mcp.tools["get_screen"](module_id="home")
        assert result == screen

    @pytest.mark.asyncio
    async def test_get_screen_returns_none_for_missing(self):
        mcp, store = self._setup()
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            result = await mcp.tools["get_screen"](module_id="nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_component_merges_props(self):
        mcp, store = self._setup()
        screen = {
            "module_id": "home",
            "rows": [{
                "id": "r1",
                "cells": [{
                    "id": "c1",
                    "content": {
                        "type": "Text", "id": "greeting",
                        "props": {"content": "Hello", "variant": "heading"},
                    },
                }],
            }],
        }
        await store.save_screen("u1", "home", screen)
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            result = await mcp.tools["update_component"](
                module_id="home", component_id="greeting",
                props={"content": "Good morning"},
            )
        updated_content = result["rows"][0]["cells"][0]["content"]
        assert updated_content["props"]["content"] == "Good morning"
        assert updated_content["props"]["variant"] == "heading"  # preserved

    @pytest.mark.asyncio
    async def test_update_component_raises_for_missing_screen(self):
        mcp, store = self._setup()
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            with pytest.raises(ValueError, match="No screen found"):
                await mcp.tools["update_component"](
                    module_id="nonexistent", component_id="x", props={},
                )

    @pytest.mark.asyncio
    async def test_update_component_raises_for_missing_component(self):
        mcp, store = self._setup()
        screen = {
            "module_id": "home",
            "rows": [{"id": "r1", "cells": [{"id": "c1", "content": {
                "type": "Text", "id": "t1", "props": {"content": "Hi"},
            }}]}],
        }
        await store.save_screen("u1", "home", screen)
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            with pytest.raises(ValueError, match="Component not found"):
                await mcp.tools["update_component"](
                    module_id="home", component_id="nonexistent", props={},
                )

    @pytest.mark.asyncio
    async def test_list_screens_returns_module_ids(self):
        mcp, store = self._setup()
        await store.save_screen("u1", "home", {"rows": []})
        await store.save_screen("u1", "settings", {"rows": []})
        with patch("keel_server.sdui_tools.get_current_user_id", return_value="u1"):
            result = await mcp.tools["list_screens"]()
        assert sorted(result) == ["home", "settings"]

    @pytest.mark.asyncio
    async def test_validate_form_valid(self):
        mcp, _ = self._setup()
        fields = [{"id": "name", "type": "text", "label": "Name", "required": True}]
        data = {"name": "Alice"}
        result = await mcp.tools["validate_form"](fields=fields, data=data)
        assert result["valid"] is True
        assert result["errors"] == []

    @pytest.mark.asyncio
    async def test_validate_form_invalid(self):
        mcp, _ = self._setup()
        fields = [{"id": "name", "type": "text", "label": "Name", "required": True}]
        data = {"name": ""}
        result = await mcp.tools["validate_form"](fields=fields, data=data)
        assert result["valid"] is False
        assert len(result["errors"]) == 1

    @pytest.mark.asyncio
    async def test_all_five_tools_registered(self):
        mcp, _ = self._setup()
        expected = {"render_screen", "get_screen", "update_component", "list_screens", "validate_form"}
        assert set(mcp.tools.keys()) == expected
