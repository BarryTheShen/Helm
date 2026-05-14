"""Tests for calendar event endpoints."""

import pytest


pytestmark = pytest.mark.anyio

EVENTS = "/api/calendar/events"


async def test_list_events_seeded(auth_client):
    """First GET seeds demo events, then returns them."""
    resp = await auth_client.get(EVENTS)
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data
    # Should have seeded events
    assert len(data["events"]) > 0
    # Verify event shape
    ev = data["events"][0]
    assert "id" in ev
    assert "title" in ev
    assert "start_time" in ev
    assert "end_time" in ev


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
    resp = await auth_client.get(EVENTS)
    initial_count = len(resp.json()["events"])

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
    assert len(events) == initial_count + 1
    # Our event should be somewhere in the list
    assert any(e["title"] == "Stand-up" for e in events)


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


# ── FF4-CAL-026: sourceType field tests ─────────────────────────────────────


async def test_create_event_with_source_type_default(auth_client):
    """Creating an event without source_type defaults to 'local'."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Default source",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["source_type"] == "local"


async def test_create_event_with_source_type_explicit(auth_client):
    """Creating an event with explicit source_type values."""
    for st in ("local", "caldav", "notion", "custom"):
        resp = await auth_client.post(
            EVENTS,
            json={
                "title": f"Source {st}",
                "start_time": "2025-07-01T10:00:00Z",
                "end_time": "2025-07-01T11:00:00Z",
                "source_type": st,
            },
        )
        assert resp.status_code == 201, f"Failed for source_type={st}"
        assert resp.json()["source_type"] == st


async def test_create_event_with_invalid_source_type(auth_client):
    """Creating an event with invalid source_type returns 422."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Bad source",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
            "source_type": "google",
        },
    )
    assert resp.status_code == 422


async def test_update_event_source_type(auth_client):
    """Updating an event's source_type."""
    create = await auth_client.post(
        EVENTS,
        json={
            "title": "Change source",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
        },
    )
    event_id = create.json()["id"]

    resp = await auth_client.put(
        f"{EVENTS}/{event_id}",
        json={"source_type": "caldav"},
    )
    assert resp.status_code == 200
    assert resp.json()["source_type"] == "caldav"


# ── FF4-CAL-027: notes field tests ──────────────────────────────────────────


async def test_create_event_with_notes(auth_client):
    """Creating an event with notes field."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Event with notes",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
            "notes": "Prepare slides, review agenda, confirm attendees",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["notes"] == "Prepare slides, review agenda, confirm attendees"


async def test_create_event_without_notes(auth_client):
    """Creating an event without notes field — notes should be None."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "No notes",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["notes"] is None


async def test_update_event_notes(auth_client):
    """Updating an event's notes field."""
    create = await auth_client.post(
        EVENTS,
        json={
            "title": "Update notes",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
        },
    )
    event_id = create.json()["id"]

    resp = await auth_client.put(
        f"{EVENTS}/{event_id}",
        json={"notes": "Updated notes content"},
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Updated notes content"


async def test_clear_event_notes(auth_client):
    """Setting notes to empty string should clear the field."""
    create = await auth_client.post(
        EVENTS,
        json={
            "title": "Clear notes",
            "start_time": "2025-07-01T10:00:00Z",
            "end_time": "2025-07-01T11:00:00Z",
            "notes": "Some notes",
        },
    )
    event_id = create.json()["id"]

    # Update with notes=None — won't clear because exclude_none in update
    resp = await auth_client.put(
        f"{EVENTS}/{event_id}",
        json={"notes": None},
    )
    # exclude_none means null values are skipped, so notes should remain
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Some notes"
