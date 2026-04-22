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
    # Enable auto-approve so the screen goes live directly
    await auth_client.put("/api/sdui/home/config", json={"auto_approve_drafts": True})
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


# ── Execute — set_variable ─────────────────────────────────────────────────

async def test_execute_set_variable_create(auth_client):
    """set_variable creates a new variable if it doesn't exist."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "set_variable",
            "params": {"name": "theme", "value": "dark"},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["name"] == "theme"
    assert data["result"]["value"] == "dark"


async def test_execute_set_variable_update(auth_client):
    """set_variable updates an existing variable."""
    # Create
    await auth_client.post(
        "/api/actions/execute",
        json={"function": "set_variable", "params": {"name": "counter", "value": "1"}},
    )
    # Update
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "set_variable", "params": {"name": "counter", "value": "2"}},
    )
    assert resp.status_code == 200
    assert resp.json()["result"]["value"] == "2"

    # Verify via variables API
    list_resp = await auth_client.get("/api/variables")
    variables = list_resp.json()["items"]
    counter = [v for v in variables if v["name"] == "counter"]
    assert len(counter) == 1
    assert counter[0]["value"] == "2"


async def test_execute_set_variable_missing_name(auth_client):
    """set_variable without name returns error."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "set_variable", "params": {"value": "x"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["status"] == "error"
    assert "name required" in data["result"]["detail"]


async def test_set_variable_in_functions_list(auth_client):
    """set_variable should appear in the functions list."""
    resp = await auth_client.get("/api/actions/functions")
    assert "set_variable" in resp.json()["functions"]


# ── Execute — fetch_weather ────────────────────────────────────────────────

async def test_execute_fetch_weather_missing_location(auth_client):
    """fetch_weather without location returns error."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "fetch_weather", "params": {"connection_id": "test-id"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["status"] == "error"
    assert "location" in data["result"]["detail"]


async def test_execute_fetch_weather_missing_connection_id(auth_client):
    """fetch_weather without connection_id returns error."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "fetch_weather", "params": {"location": "London"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["status"] == "error"
    assert "connection_id" in data["result"]["detail"]


async def test_execute_fetch_weather_invalid_connection(auth_client):
    """fetch_weather with non-existent connection returns error."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "fetch_weather", "params": {"location": "London", "connection_id": "nonexistent"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["status"] == "error"
    assert "not found" in data["result"]["detail"]


async def test_fetch_weather_in_functions_list(auth_client):
    """fetch_weather should appear in the functions list."""
    resp = await auth_client.get("/api/actions/functions")
    assert "fetch_weather" in resp.json()["functions"]


# ── Execute — run_workflow ─────────────────────────────────────────────────

async def test_execute_run_workflow_missing_id(auth_client):
    """run_workflow without workflow_id returns error."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "run_workflow", "params": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["status"] == "error"
    assert "workflow_id is required" in data["result"]["detail"]


async def test_execute_run_workflow_not_found(auth_client):
    """run_workflow with non-existent workflow returns error."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "run_workflow", "params": {"workflow_id": "nonexistent"}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["result"]["status"] == "error"
    assert "not found" in data["result"]["detail"]


async def test_execute_run_workflow_disabled(auth_client):
    """run_workflow with disabled workflow returns error."""
    # Create a disabled workflow
    create_resp = await auth_client.post(
        "/api/workflows",
        json={
            "name": "Disabled Workflow",
            "description": "Test workflow",
            "enabled": False,
            "trigger_type": "manual",
            "graph": {"nodes": [], "edges": []},
        },
    )
    workflow_id = create_resp.json()["id"]

    # Try to run it
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "run_workflow", "params": {"workflow_id": workflow_id}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["status"] == "error"
    assert "disabled" in data["result"]["detail"]


async def test_execute_run_workflow_success(auth_client):
    """run_workflow executes an enabled workflow."""
    # Create an enabled workflow
    create_resp = await auth_client.post(
        "/api/workflows",
        json={
            "name": "Test Workflow",
            "description": "Test workflow",
            "enabled": True,
            "trigger_type": "manual",
            "graph": {"nodes": [], "edges": []},
        },
    )
    workflow_id = create_resp.json()["id"]

    # Run it
    resp = await auth_client.post(
        "/api/actions/execute",
        json={"function": "run_workflow", "params": {"workflow_id": workflow_id}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["workflow_id"] == workflow_id
    assert data["result"]["workflow_name"] == "Test Workflow"
    assert data["result"]["executed"] is True


async def test_run_workflow_in_functions_list(auth_client):
    """run_workflow should appear in the functions list."""
    resp = await auth_client.get("/api/actions/functions")
    assert "run_workflow" in resp.json()["functions"]
