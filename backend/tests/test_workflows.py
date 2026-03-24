"""Tests for workflow CRUD endpoints."""

import pytest


pytestmark = pytest.mark.anyio

WORKFLOWS = "/api/workflows"


async def test_list_workflows_empty(auth_client):
    resp = await auth_client.get(WORKFLOWS)
    assert resp.status_code == 200
    assert resp.json() == []


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
            "action_config": {"action_type": "send_notification", "title": "New event!"},
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Notify on event"
    assert data["trigger_type"] == "event_created"
    assert data["is_active"] is True
    assert "id" in data


async def test_create_workflow_schedule_trigger(auth_client):
    resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Daily briefing",
            "trigger_type": "schedule",
            "trigger_config": {"cron": "0 8 * * *"},
            "action_config": {"action_type": "send_notification", "title": "Good morning!"},
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
            "action_config": {},
        },
    )
    await auth_client.post(
        WORKFLOWS,
        json={
            "name": "WF 2",
            "trigger_type": "form_submitted",
            "trigger_config": {},
            "action_config": {},
        },
    )
    resp = await auth_client.get(WORKFLOWS)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_get_workflow_by_id_via_list(auth_client):
    create_resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Fetch me",
            "trigger_type": "event_created",
            "trigger_config": {},
            "action_config": {},
        },
    )
    wf_id = create_resp.json()["id"]
    list_resp = await auth_client.get(WORKFLOWS)
    wfs = list_resp.json()
    assert any(w["id"] == wf_id and w["name"] == "Fetch me" for w in wfs)


async def test_update_workflow(auth_client):
    create_resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "Old name",
            "trigger_type": "event_updated",
            "trigger_config": {},
            "action_config": {},
        },
    )
    wf_id = create_resp.json()["id"]
    resp = await auth_client.put(
        f"{WORKFLOWS}/{wf_id}",
        json={"name": "New name", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New name"
    assert data["is_active"] is False


async def test_delete_workflow(auth_client):
    create_resp = await auth_client.post(
        WORKFLOWS,
        json={
            "name": "To delete",
            "trigger_type": "schedule",
            "trigger_config": {"cron": "0 9 * * *"},
            "action_config": {},
        },
    )
    wf_id = create_resp.json()["id"]
    del_resp = await auth_client.delete(f"{WORKFLOWS}/{wf_id}")
    assert del_resp.status_code == 204
    list_resp = await auth_client.get(WORKFLOWS)
    ids = [w["id"] for w in list_resp.json()]
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
