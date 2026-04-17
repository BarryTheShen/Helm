"""Tests for workflow CRUD endpoints."""

import pytest


pytestmark = pytest.mark.anyio

WORKFLOWS = "/api/workflows"
N8N_IMPORT = "/api/workflows/import/n8n"


async def test_list_workflows_empty(auth_client):
    resp = await auth_client.get(WORKFLOWS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_workflows_requires_auth(client):
    resp = await client.get(WORKFLOWS)
    assert resp.status_code == 401


async def test_create_workflow_event_trigger(auth_client):
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Notify on event",
            "trigger_type": "event_created",
            "trigger_config": {},
            "graph": {"nodes": [{"type": "action", "data": {"tool": "send_notification", "args": {"title": "New event!"}}}], "edges": []},
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Notify on event"
    assert data["trigger_type"] == "event_created"
    assert data["enabled"] is True
    assert "id" in data


async def test_create_workflow_schedule_trigger(auth_client):
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Daily briefing",
            "trigger_type": "schedule",
            "trigger_config": {"cron": "0 8 * * *"},
            "graph": {"nodes": [{"type": "action", "data": {"tool": "send_notification", "args": {"title": "Good morning!"}}}], "edges": []},
        },
    )
    assert resp.status_code == 201
    assert resp.json()["trigger_type"] == "schedule"


async def test_list_workflows_after_create(auth_client):
    await auth_client.post(
        WORKFLOWS,
        json={
            "name": "WF 1",
            "trigger_type": "message_received",
            "trigger_config": {},
            "graph": {},
        },
    )
    await auth_client.post(
        WORKFLOWS,
        json={
            "name": "WF 2",
            "trigger_type": "form_submitted",
            "trigger_config": {},
            "graph": {},
        },
    )
    resp = await auth_client.get(WORKFLOWS)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


async def test_get_workflow_by_id_via_list(auth_client):
    create_resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Fetch me",
            "trigger_type": "event_created",
            "trigger_config": {},
            "graph": {},
        },
    )
    wf_id = create_resp.json()["id"]
    list_resp = await auth_client.get(WORKFLOWS)
    wfs = list_resp.json()["items"]
    assert any(w["id"] == wf_id and w["name"] == "Fetch me" for w in wfs)


async def test_update_workflow(auth_client):
    create_resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Old name",
            "trigger_type": "event_updated",
            "trigger_config": {},
            "graph": {},
        },
    )
    wf_id = create_resp.json()["id"]
    resp = await auth_client.put(
        f"{WORKFLOWS}/{wf_id}",
        json={"name": "New name", "enabled": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New name"
    assert data["enabled"] is False


async def test_delete_workflow(auth_client):
    create_resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "To delete",
            "trigger_type": "schedule",
            "trigger_config": {"cron": "0 9 * * *"},
            "graph": {},
        },
    )
    wf_id = create_resp.json()["id"]
    del_resp = await auth_client.delete(f"{WORKFLOWS}/{wf_id}")
    assert del_resp.status_code == 204
    list_resp = await auth_client.get(WORKFLOWS)
    ids = [w["id"] for w in list_resp.json()["items"]]
    assert wf_id not in ids


async def test_update_workflow_not_found(auth_client):
    resp = await auth_client.put(
        f"{WORKFLOWS}/nonexistent-id",
        json={"name": "Ghost"},
    )
    assert resp.status_code == 404


async def test_delete_workflow_not_found(auth_client):
    resp = await auth_client.delete(f"{WORKFLOWS}/nonexistent-id")
    assert resp.status_code == 404


# ── New Trigger Types ──────────────────────────────────────────────────────

async def test_create_workflow_data_changed_trigger(auth_client):
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "On data change",
            "trigger_type": "data_changed",
            "trigger_config": {"source_type": "calendar"},
            "graph": {"nodes": [{"type": "action", "data": {"tool": "refresh_data", "args": {}}}], "edges": []},
        },
    )
    assert resp.status_code == 201
    assert resp.json()["trigger_type"] == "data_changed"


async def test_create_workflow_server_event_trigger(auth_client):
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "On server event",
            "trigger_type": "server_event",
            "trigger_config": {"event_name": "user_login"},
            "graph": {"nodes": [{"type": "action", "data": {"tool": "send_notification", "args": {"title": "Welcome back!"}}}], "edges": []},
        },
    )
    assert resp.status_code == 201
    assert resp.json()["trigger_type"] == "server_event"


# ── React Flow Graph Execution Tests ───────────────────────────────────────

async def test_workflow_graph_sequential_actions(auth_client):
    """Test sequential action execution following edges."""
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Sequential actions",
            "trigger_type": "manual",
            "trigger_config": {},
            "graph": {
                "nodes": [
                    {"id": "1", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Step 1", "message": "First"}}},
                    {"id": "2", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Step 2", "message": "Second"}}},
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["graph"]["nodes"]) == 2
    assert len(data["graph"]["edges"]) == 1


async def test_workflow_graph_with_condition(auth_client):
    """Test conditional branching in workflow graph."""
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Conditional workflow",
            "trigger_type": "manual",
            "trigger_config": {},
            "graph": {
                "nodes": [
                    {"id": "1", "type": "action", "data": {"tool": "get_chat_history", "args": {"limit": 10}}},
                    {"id": "2", "type": "condition", "data": {"condition": "results.1.length > 0"}},
                    {"id": "3", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Has messages"}}},
                    {"id": "4", "type": "action", "data": {"tool": "send_notification", "args": {"title": "No messages"}}},
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3", "sourceHandle": "true"},
                    {"id": "e2-4", "source": "2", "target": "4", "sourceHandle": "false"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["graph"]["nodes"]) == 4
    assert len(data["graph"]["edges"]) == 3


async def test_workflow_graph_with_switch(auth_client):
    """Test switch/case branching in workflow graph."""
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Switch workflow",
            "trigger_type": "manual",
            "trigger_config": {},
            "graph": {
                "nodes": [
                    {"id": "1", "type": "switch", "data": {"value": "event.type"}},
                    {"id": "2", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Calendar event"}}},
                    {"id": "3", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Chat message"}}},
                    {"id": "4", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Other event"}}},
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2", "sourceHandle": "calendar"},
                    {"id": "e1-3", "source": "1", "target": "3", "sourceHandle": "chat"},
                    {"id": "e1-4", "source": "1", "target": "4", "sourceHandle": "default"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["graph"]["nodes"]) == 4


async def test_workflow_graph_with_loop(auth_client):
    """Test loop node in workflow graph."""
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Loop workflow",
            "trigger_type": "manual",
            "trigger_config": {},
            "graph": {
                "nodes": [
                    {"id": "1", "type": "action", "data": {"tool": "read_all_calendar", "args": {}}},
                    {"id": "2", "type": "loop", "data": {"items": "results.1"}},
                    {"id": "3", "type": "action", "data": {"tool": "send_notification", "args": {"title": "{{loop.item.title}}"}}},
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["graph"]["nodes"]) == 3


async def test_workflow_graph_parallel_branches(auth_client):
    """Test parallel execution of independent branches."""
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Parallel workflow",
            "trigger_type": "manual",
            "trigger_config": {},
            "graph": {
                "nodes": [
                    {"id": "1", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Start"}}},
                    {"id": "2", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Branch A"}}},
                    {"id": "3", "type": "action", "data": {"tool": "send_notification", "args": {"title": "Branch B"}}},
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e1-3", "source": "1", "target": "3"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["graph"]["edges"]) == 2


async def test_import_n8n_workflow_basic(auth_client):
    """Test importing a basic n8n workflow."""
    n8n_workflow = {
        "name": "Test n8n workflow",
        "nodes": [
            {
                "id": "node1",
                "name": "HTTP Request",
                "type": "n8n-nodes-base.httpRequest",
                "parameters": {"url": "https://api.example.com/data"},
                "position": [100, 200],
            },
            {
                "id": "node2",
                "name": "Set Variables",
                "type": "n8n-nodes-base.set",
                "parameters": {"values": {"key": "value"}},
                "position": [300, 200],
            },
        ],
        "connections": {
            "node1": {
                "main": [[{"node": "node2", "type": "main", "index": 0}]],
            },
        },
    }

    resp = await auth_client.post(N8N_IMPORT, json={"workflow": n8n_workflow})
    assert resp.status_code == 200
    data = resp.json()

    # Check translated workflow structure
    assert "workflow" in data
    assert "warnings" in data
    helm_wf = data["workflow"]

    # Verify nodes
    assert len(helm_wf["nodes"]) == 2
    assert helm_wf["nodes"][0]["id"] == "node1"
    assert helm_wf["nodes"][0]["type"] == "action"
    assert helm_wf["nodes"][0]["data"]["label"] == "HTTP Request"
    assert helm_wf["nodes"][0]["position"]["x"] == 100
    assert helm_wf["nodes"][0]["position"]["y"] == 200

    # Verify edges
    assert len(helm_wf["edges"]) == 1
    assert helm_wf["edges"][0]["source"] == "node1"
    assert helm_wf["edges"][0]["target"] == "node2"


async def test_import_n8n_workflow_with_conditionals(auth_client):
    """Test importing n8n workflow with IF node."""
    n8n_workflow = {
        "name": "Conditional workflow",
        "nodes": [
            {"id": "start", "name": "Start", "type": "n8n-nodes-base.webhook", "parameters": {}, "position": [0, 0]},
            {"id": "check", "name": "Check Condition", "type": "n8n-nodes-base.if", "parameters": {"condition": "value > 10"}, "position": [200, 0]},
            {"id": "true_branch", "name": "True Action", "type": "n8n-nodes-base.httpRequest", "parameters": {}, "position": [400, -50]},
            {"id": "false_branch", "name": "False Action", "type": "n8n-nodes-base.httpRequest", "parameters": {}, "position": [400, 50]},
        ],
        "connections": {
            "start": {"main": [[{"node": "check"}]]},
            "check": {
                "main": [
                    [{"node": "true_branch"}],
                    [{"node": "false_branch"}],
                ],
            },
        },
    }

    resp = await auth_client.post(N8N_IMPORT, json={"workflow": n8n_workflow})
    assert resp.status_code == 200
    data = resp.json()

    helm_wf = data["workflow"]
    assert len(helm_wf["nodes"]) == 4
    assert helm_wf["nodes"][1]["type"] == "condition"
    assert len(helm_wf["edges"]) == 3


async def test_import_n8n_workflow_unsupported_nodes(auth_client):
    """Test importing n8n workflow with unsupported node types."""
    n8n_workflow = {
        "name": "Unsupported nodes",
        "nodes": [
            {"id": "node1", "name": "Custom Node", "type": "n8n-nodes-custom.unknown", "parameters": {}, "position": [0, 0]},
            {"id": "node2", "name": "Another Unknown", "type": "n8n-nodes-base.someNewNode", "parameters": {}, "position": [200, 0]},
        ],
        "connections": {
            "node1": {"main": [[{"node": "node2"}]]},
        },
    }

    resp = await auth_client.post(N8N_IMPORT, json={"workflow": n8n_workflow})
    assert resp.status_code == 200
    data = resp.json()

    # Should have warnings about unsupported types
    assert len(data["warnings"]) == 2
    assert "n8n-nodes-custom.unknown" in data["warnings"][0]
    assert "n8n-nodes-base.someNewNode" in data["warnings"][1]

    # Should still translate to action nodes
    helm_wf = data["workflow"]
    assert len(helm_wf["nodes"]) == 2
    assert all(node["type"] == "action" for node in helm_wf["nodes"])
