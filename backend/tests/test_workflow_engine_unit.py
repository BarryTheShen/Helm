"""Unit tests for workflow engine node execution logic."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.workflow_engine import _execute_node, _resolve_variables, _evaluate_condition


pytestmark = pytest.mark.anyio


async def test_parallel_node_returns_all_targets():
    """Test that parallel node returns all target node IDs."""
    node = {"id": "parallel1", "type": "parallel", "data": {}}
    adjacency = {
        "parallel1": [
            ("branch_a", {}),
            ("branch_b", {}),
            ("branch_c", {}),
        ]
    }
    context = {"results": {}}

    result = await _execute_node(node, "parallel", "user123", context, adjacency)

    assert result == ["branch_a", "branch_b", "branch_c"]
    assert context["results"]["parallel1"]["branches"] == 3


async def test_loop_with_fixed_iterations():
    """Test loop node with fixed iteration count."""
    node = {
        "id": "loop1",
        "type": "loop",
        "data": {"iterations": 5, "variable": "counter", "index_variable": "idx"}
    }
    adjacency = {"loop1": [("body_node", {"sourceHandle": "body"})]}
    context = {"results": {}}

    result = await _execute_node(node, "loop", "user123", context, adjacency)

    assert context["results"]["loop1"]["iterations"] == 5
    assert len(context["results"]["loop1"]["results"]) == 5
    assert context["counter"] == 4  # Last iteration value
    assert context["idx"] == 4


async def test_loop_with_collection():
    """Test loop node iterating over a collection."""
    node = {
        "id": "loop1",
        "type": "loop",
        "data": {"items": "{{events}}", "variable": "event", "index_variable": "i"}
    }
    adjacency = {"loop1": [("body_node", {"sourceHandle": "body"})]}
    context = {
        "results": {},
        "events": [{"title": "Event 1"}, {"title": "Event 2"}, {"title": "Event 3"}]
    }

    result = await _execute_node(node, "loop", "user123", context, adjacency)

    assert context["results"]["loop1"]["iterations"] == 3
    assert context["event"] == {"title": "Event 3"}  # Last item
    assert context["i"] == 2


async def test_delay_node_seconds():
    """Test delay node with seconds unit."""
    node = {
        "id": "delay1",
        "type": "delay",
        "data": {"duration": 0.1, "unit": "seconds"}
    }
    adjacency = {}
    context = {"results": {}}

    import time
    start = time.time()
    result = await _execute_node(node, "delay", "user123", context, adjacency)
    elapsed = time.time() - start

    assert elapsed >= 0.1
    assert context["results"]["delay1"]["waited"] == 0.1
    assert result is None


async def test_delay_node_minutes():
    """Test delay node with minutes unit (short duration for testing)."""
    node = {
        "id": "delay1",
        "type": "delay",
        "data": {"duration": 0.001, "unit": "minutes"}
    }
    adjacency = {}
    context = {"results": {}}

    result = await _execute_node(node, "delay", "user123", context, adjacency)

    assert context["results"]["delay1"]["waited"] == 0.06  # 0.001 * 60
    assert result is None


async def test_try_catch_node_structure():
    """Test try/catch node returns correct branches."""
    node = {
        "id": "try1",
        "type": "try_catch",
        "data": {}
    }
    adjacency = {
        "try1": [
            ("try_branch", {"sourceHandle": "try"}),
            ("catch_branch", {"sourceHandle": "catch"}),
        ]
    }
    context = {"results": {}}

    result = await _execute_node(node, "try_catch", "user123", context, adjacency)

    # Should follow try branch by default
    assert result == ["try_branch"]
    assert context["results"]["try1"]["status"] == "success"


async def test_trigger_node_schedule():
    """Test trigger node with onSchedule type."""
    node = {
        "id": "trigger1",
        "type": "trigger",
        "data": {
            "trigger_type": "onSchedule",
            "trigger_config": {"cron": "0 9 * * *"}
        }
    }
    adjacency = {}
    context = {"results": {}}

    result = await _execute_node(node, "trigger", "user123", context, adjacency)

    assert context["trigger"]["type"] == "onSchedule"
    assert context["trigger"]["config"]["cron"] == "0 9 * * *"
    assert "timestamp" in context["trigger"]
    assert result is None


async def test_trigger_node_data_change():
    """Test trigger node with onDataChange type."""
    node = {
        "id": "trigger1",
        "type": "trigger",
        "data": {
            "trigger_type": "onDataChange",
            "trigger_config": {"source_type": "calendar"}
        }
    }
    adjacency = {}
    context = {"results": {}}

    result = await _execute_node(node, "trigger", "user123", context, adjacency)

    assert context["trigger"]["type"] == "onDataChange"
    assert context["trigger"]["config"]["source_type"] == "calendar"


async def test_trigger_node_server_event():
    """Test trigger node with onServerEvent type."""
    node = {
        "id": "trigger1",
        "type": "trigger",
        "data": {
            "trigger_type": "onServerEvent",
            "trigger_config": {"event_name": "user_login"}
        }
    }
    adjacency = {}
    context = {"results": {}}

    result = await _execute_node(node, "trigger", "user123", context, adjacency)

    assert context["trigger"]["type"] == "onServerEvent"
    assert context["trigger"]["config"]["event_name"] == "user_login"


def test_resolve_variables_nested():
    """Test variable resolution with nested paths."""
    context = {
        "results": {
            "node1": {
                "data": {
                    "items": [{"name": "Item 1"}, {"name": "Item 2"}]
                }
            }
        }
    }

    value = "{{results.node1.data.items}}"
    resolved = _resolve_variables(value, context)

    assert resolved == [{"name": "Item 1"}, {"name": "Item 2"}]


def test_resolve_variables_in_dict():
    """Test variable resolution in nested dictionaries."""
    context = {"user": {"name": "Alice"}, "count": 5}

    value = {
        "name": "{{user.name}}",
        "total": "{{count}}",
        "nested": {
            "user_name": "{{user.name}}"
        }
    }

    resolved = _resolve_variables(value, context)

    assert resolved["name"] == "Alice"
    assert resolved["total"] == 5
    assert resolved["nested"]["user_name"] == "Alice"


def test_evaluate_condition_equality():
    """Test condition evaluation with equality operator."""
    context = {"status": "active"}

    result = _evaluate_condition("active == active", context)
    assert result is True

    result = _evaluate_condition("active == inactive", context)
    assert result is False


def test_evaluate_condition_inequality():
    """Test condition evaluation with inequality operator."""
    context = {"status": "active"}

    result = _evaluate_condition("active != inactive", context)
    assert result is True

    result = _evaluate_condition("active != active", context)
    assert result is False


def test_evaluate_condition_empty():
    """Test that empty condition evaluates to True."""
    context = {}

    result = _evaluate_condition("", context)
    assert result is True
