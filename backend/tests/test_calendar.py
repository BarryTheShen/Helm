"""Tests for calendar event endpoints."""

import pytest


pytestmark = pytest.mark.anyio

EVENTS = "/api/calendar/events"


async def test_list_events_empty(auth_client):
    resp = await auth_client.get(EVENTS)
    assert resp.status_code == 200
    assert resp.json()["events"] == []


async def test_create_event(auth_client):
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Team meeting",
            "start_time": "2025-06-01T10:00:00Z",
            "end_time": "2025-06-01T11:00:00Z",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Team meeting"
    assert "id" in data


async def test_create_event_with_optional_fields(auth_client):
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Doctor appointment",
            "start_time": "2025-06-02T09:00:00Z",
            "end_time": "2025-06-02T09:30:00Z",
            "description": "Annual checkup",
            "color": "#FF5733",
            "location": "City Clinic",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Annual checkup"
    assert data["color"] == "#FF5733"
    assert data["location"] == "City Clinic"


async def test_list_events_after_create(auth_client):
    await auth_client.post(
        EVENTS,
        json={
            "title": "Stand-up",
            "start_time": "2025-06-01T09:00:00Z",
            "end_time": "2025-06-01T09:15:00Z",
        },
    )
    resp = await auth_client.get(EVENTS)
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["title"] == "Stand-up"


async def test_get_event_by_id_via_list(auth_client):
    create_resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Dentist",
            "start_time": "2025-06-03T14:00:00Z",
            "end_time": "2025-06-03T15:00:00Z",
        },
    )
    event_id = create_resp.json()["id"]
    list_resp = await auth_client.get(EVENTS)
    events = list_resp.json()["events"]
    assert any(e["id"] == event_id and e["title"] == "Dentist" for e in events)


async def test_update_event(auth_client):
    create_resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Old title",
            "start_time": "2025-06-04T08:00:00Z",
            "end_time": "2025-06-04T09:00:00Z",
        },
    )
    event_id = create_resp.json()["id"]
    update_resp = await auth_client.put(
        f"{EVENTS}/{event_id}",
        json={"title": "New title"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "New title"


async def test_delete_event(auth_client):
    create_resp = await auth_client.post(
        EVENTS,
        json={
            "title": "To delete",
            "start_time": "2025-06-05T10:00:00Z",
            "end_time": "2025-06-05T11:00:00Z",
        },
    )
    event_id = create_resp.json()["id"]
    del_resp = await auth_client.delete(f"{EVENTS}/{event_id}")
    assert del_resp.status_code == 200
    list_resp = await auth_client.get(EVENTS)
    ids = [e["id"] for e in list_resp.json()["events"]]
    assert event_id not in ids


async def test_event_requires_auth(client):
    resp = await client.get(EVENTS)
    assert resp.status_code == 401
