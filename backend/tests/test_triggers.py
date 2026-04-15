"""Tests for trigger CRUD endpoints and fire/test."""

import json

import pytest


pytestmark = pytest.mark.anyio

TRIGGERS = "/api/triggers"


async def test_list_triggers_empty(auth_client):
    resp = await auth_client.get(TRIGGERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_triggers_requires_auth(client):
    resp = await client.get(TRIGGERS)
    assert resp.status_code == 401


async def test_create_trigger(auth_client):
    resp = await auth_client.post(
        TRIGGERS,
        json={
            "name": "Daily check",
            "trigger_type": "schedule",
            "config_json": json.dumps({"cron": "0 8 * * *"}),
            "action_chain_json": json.dumps([{"type": "show_notification", "params": {"title": "Hello"}}]),
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Daily check"
    assert data["trigger_type"] == "schedule"
    assert data["enabled"] is True
    assert "id" in data


async def test_list_triggers_after_create(auth_client):
    await auth_client.post(
        TRIGGERS,
        json={
            "name": "T1",
            "trigger_type": "data_change",
            "config_json": "{}",
            "action_chain_json": "[]",
        },
    )
    await auth_client.post(
        TRIGGERS,
        json={
            "name": "T2",
            "trigger_type": "server_event",
            "config_json": "{}",
            "action_chain_json": "[]",
        },
    )
    resp = await auth_client.get(TRIGGERS)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


async def test_update_trigger(auth_client):
    create_resp = await auth_client.post(
        TRIGGERS,
        json={
            "name": "Old name",
            "trigger_type": "schedule",
            "config_json": "{}",
            "action_chain_json": "[]",
        },
    )
    trigger_id = create_resp.json()["id"]

    update_resp = await auth_client.put(
        f"{TRIGGERS}/{trigger_id}",
        json={"name": "New name", "enabled": False},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["name"] == "New name"
    assert data["enabled"] is False


async def test_delete_trigger(auth_client):
    create_resp = await auth_client.post(
        TRIGGERS,
        json={
            "name": "Delete me",
            "trigger_type": "schedule",
            "config_json": "{}",
            "action_chain_json": "[]",
        },
    )
    trigger_id = create_resp.json()["id"]

    del_resp = await auth_client.delete(f"{TRIGGERS}/{trigger_id}")
    assert del_resp.status_code == 204

    list_resp = await auth_client.get(TRIGGERS)
    assert list_resp.json()["total"] == 0


async def test_delete_nonexistent_trigger(auth_client):
    resp = await auth_client.delete(f"{TRIGGERS}/nonexistent-id")
    assert resp.status_code == 404


async def test_update_nonexistent_trigger(auth_client):
    resp = await auth_client.put(
        f"{TRIGGERS}/nonexistent-id",
        json={"name": "nope"},
    )
    assert resp.status_code == 404


async def test_fire_trigger(auth_client):
    """Test the POST /api/triggers/{id}/test endpoint fires the action chain."""
    create_resp = await auth_client.post(
        TRIGGERS,
        json={
            "name": "Testable",
            "trigger_type": "server_event",
            "config_json": "{}",
            "action_chain_json": json.dumps([
                {"type": "show_notification", "params": {"title": "Test"}}
            ]),
        },
    )
    trigger_id = create_resp.json()["id"]

    fire_resp = await auth_client.post(f"{TRIGGERS}/{trigger_id}/test")
    assert fire_resp.status_code == 200
    data = fire_resp.json()
    assert data["status"] == "ok"
    assert data["trigger_id"] == trigger_id
    assert isinstance(data["result"], list)


async def test_fire_nonexistent_trigger(auth_client):
    resp = await auth_client.post(f"{TRIGGERS}/nonexistent-id/test")
    assert resp.status_code == 404
