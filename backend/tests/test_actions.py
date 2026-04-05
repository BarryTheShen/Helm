"""Tests for the action system (POST /api/actions/execute, registry)."""

import pytest

pytestmark = pytest.mark.anyio


# ── List Functions ─────────────────────────────────────────────────────────

async def test_list_functions_requires_auth(client):
    resp = await client.get("/api/actions/functions")
    assert resp.status_code == 401


async def test_list_functions(auth_client):
    resp = await auth_client.get("/api/actions/functions")
    assert resp.status_code == 200
    functions = resp.json()["functions"]
    assert isinstance(functions, list)
    assert "refresh_data" in functions
    assert "submit_form" in functions
    assert "mark_notification_read" in functions
    assert "create_calendar_event" in functions
    assert "delete_calendar_event" in functions
    assert "approve_draft" in functions
    assert "reject_draft" in functions


# ── Execute — Auth & Validation ────────────────────────────────────────────

async def test_execute_requires_auth(client):
    resp = await client.post(
        "/api/actions/execute",
        json={"function": "refresh_data", "params": {}},
    )
    assert resp.status_code == 401


async def test_execute_unknown_function(auth_client):
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "nonexistent_function", "params": {}},
    )
    assert resp.status_code == 404
    assert "Unknown action" in resp.json()["detail"]


async def test_execute_missing_function_field(auth_client):
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"params": {}},
    )
    assert resp.status_code == 422  # Pydantic validation error


# ── Execute — refresh_data ─────────────────────────────────────────────────

async def test_execute_refresh_data_no_existing_screen(auth_client):
    """refresh_data when no SDUI screen exists returns refreshed=False."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "refresh_data", "params": {"module_id": "home"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["refreshed"] is False


async def test_execute_refresh_data_with_existing_screen(auth_client):
    """refresh_data after setting a screen returns refreshed=True."""
    # First set a screen
    await auth_client.post(
        "/api/sdui/home",
        json={"screen": {"title": "Test", "sections": []}},
    )
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "refresh_data", "params": {"module_id": "home"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["refreshed"] is True


# ── Execute — submit_form ──────────────────────────────────────────────────

async def test_execute_submit_form(auth_client):
    resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "submit_form",
            "params": {"_form_id": "contact", "name": "Alice", "email": "a@b.com"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["form_id"] == "contact"
    assert data["result"]["submission_count"] == 1


async def test_execute_submit_form_multiple(auth_client):
    """Multiple submissions to the same form accumulate."""
    for i in range(3):
        resp = await auth_client.post(
            "/api/actions/execute",
            json={
                "function": "submit_form",
                "params": {"_form_id": "survey", "answer": f"answer_{i}"},
            },
        )
        assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["submission_count"] == 3


# ── Execute — mark_notification_read ───────────────────────────────────────

async def test_execute_mark_notification_read_missing_id(auth_client):
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "mark_notification_read", "params": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["detail"] == "notification_id required"


async def test_execute_mark_notification_read_valid(auth_client, db_session):
    """Create a notification, then mark it read via action."""
    from app.models.notification import Notification
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()

    notif = Notification(
        user_id=str(user.id),
        title="Test",
        message="Hello",
        severity="info",
    )
    db_session.add(notif)
    await db_session.commit()
    await db_session.refresh(notif)
    notif_id = str(notif.id)

    resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "mark_notification_read",
            "params": {"notification_id": notif_id},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["notification_id"] == notif_id


# ── Execute — create_calendar_event ────────────────────────────────────────

async def test_execute_create_calendar_event(auth_client):
    resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "create_calendar_event",
            "params": {
                "title": "Team Standup",
                "start_time": "2026-04-01T09:00:00",
                "end_time": "2026-04-01T09:30:00",
                "description": "Daily standup",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["title"] == "Team Standup"
    assert "event_id" in data["result"]


# ── Execute — delete_calendar_event ────────────────────────────────────────

async def test_execute_delete_calendar_event_missing_id(auth_client):
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "delete_calendar_event", "params": {}},
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["detail"] == "event_id required"


async def test_execute_delete_calendar_event_valid(auth_client):
    """Create then delete a calendar event via actions."""
    # Create
    create_resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "create_calendar_event",
            "params": {
                "title": "To Delete",
                "start_time": "2026-04-01T10:00:00",
                "end_time": "2026-04-01T10:30:00",
            },
        },
    )
    event_id = create_resp.json()["result"]["event_id"]

    # Delete
    resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "delete_calendar_event",
            "params": {"event_id": event_id},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["event_id"] == event_id


# ── Execute — empty params defaults ───────────────────────────────────────

async def test_execute_with_empty_params(auth_client):
    """Actions that have defaults should work with empty params dict."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "refresh_data"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    # Default module_id should be "home"
    assert data["result"]["module_id"] == "home"
