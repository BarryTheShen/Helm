"""Tests for admin stats/analytics endpoints."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.calendar_event import CalendarEvent
from app.models.module_state import ModuleState
from app.models.notification import Notification
from app.models.template import SDUITemplate
from app.models.workflow import Workflow


pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_user_id(client: AsyncClient) -> str:
    """Return the authenticated user's ID from /api/users/me (or from users list)."""
    resp = await client.get("/api/users")
    assert resp.status_code == 200
    return resp.json()["items"][0]["id"]


async def _seed_data(client: AsyncClient, db: AsyncSession) -> str:
    """Seed several rows across tables and return the user_id used."""
    user_id = await _get_user_id(client)

    # Calendar event
    db.add(CalendarEvent(
        id=str(uuid.uuid4()), user_id=user_id, title="Meeting",
        start_time=datetime(2026, 4, 6, 10, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 6, 11, 0, tzinfo=timezone.utc),
    ))
    # Notification (unread)
    db.add(Notification(
        id=str(uuid.uuid4()), user_id=user_id, title="Alert",
        message="Test alert", is_read=False,
    ))
    # Notification (read)
    db.add(Notification(
        id=str(uuid.uuid4()), user_id=user_id, title="Old alert",
        message="Already read", is_read=True,
    ))
    # Module state — SDUI screen (should count)
    db.add(ModuleState(
        id=str(uuid.uuid4()), user_id=user_id,
        module_type="sdui__home", state_json={"rows": []},
    ))
    # Module state — draft (should NOT count)
    db.add(ModuleState(
        id=str(uuid.uuid4()), user_id=user_id,
        module_type="sdui__home__draft", state_json={"rows": []},
    ))
    # Module state — non-SDUI (should NOT count)
    db.add(ModuleState(
        id=str(uuid.uuid4()), user_id=user_id,
        module_type="_tabs_config", state_json={},
    ))
    # Template
    db.add(SDUITemplate(
        id=str(uuid.uuid4()), name="Tpl", category="custom",
        screen_json={"rows": []}, created_by=user_id,
    ))
    # Workflow (active)
    wf_id = str(uuid.uuid4())
    db.add(Workflow(
        id=wf_id, user_id=user_id, name="Automation",
        trigger_type="form_submitted", trigger_config={}, action_config={},
        is_active=True, run_count=5,
    ))
    # Workflow (inactive)
    db.add(Workflow(
        id=str(uuid.uuid4()), user_id=user_id, name="Disabled WF",
        trigger_type="schedule", trigger_config={}, action_config={},
        is_active=False, run_count=0,
    ))
    # Audit log entries (WORKFLOW_* action types for workflow analytics)
    for _ in range(3):
        db.add(AuditLog(
            id=str(uuid.uuid4()), user_id=user_id,
            action_type="WORKFLOW_EXECUTED", resource_type="workflow",
            resource_id=wf_id,
        ))
    # Non-workflow audit entry
    db.add(AuditLog(
        id=str(uuid.uuid4()), user_id=user_id,
        action_type="USER_LOGIN", resource_type="user",
    ))
    await db.commit()
    return user_id


# ---------------------------------------------------------------------------
# GET /api/admin/stats
# ---------------------------------------------------------------------------

async def test_admin_stats_returns_counts(auth_client: AsyncClient, db_session: AsyncSession):
    await _seed_data(auth_client, db_session)
    resp = await auth_client.get("/api/admin/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_users"] >= 1
    assert data["active_sessions"] >= 1  # the auth_client session
    assert data["total_events"] == 1
    assert data["total_workflows"] == 2
    assert data["active_workflows"] == 1
    assert data["total_notifications"] == 2
    assert data["unread_notifications"] == 1
    assert data["total_screens"] == 1  # only sdui__home, not draft or _tabs_config
    assert data["total_templates"] == 1
    assert data["total_audit_entries"] >= 4  # 3 workflow + 1 login + possible auth audit entries
    assert data["connected_ws_clients"] == 0  # no WS in tests


async def test_admin_stats_empty_db(auth_client: AsyncClient):
    resp = await auth_client.get("/api/admin/stats")
    assert resp.status_code == 200
    data = resp.json()
    # With only the auth user, everything else should be 0
    assert data["total_users"] >= 1
    assert data["total_events"] == 0


async def test_admin_stats_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/stats")
    assert resp.status_code == 401


async def test_admin_stats_requires_admin(client: AsyncClient):
    """A regular (non-admin) user should get 403."""
    # Create a regular user
    await client.post("/auth/setup", json={"username": "setupadmin", "password": "password123"})
    resp = await client.post("/auth/login", json={
        "username": "setupadmin", "password": "password123",
        "device_id": "dev1", "device_name": "Dev",
    })
    admin_token = resp.json()["session_token"]

    # Create a non-admin user via admin
    client.headers["Authorization"] = f"Bearer {admin_token}"
    await client.post("/api/users", json={"username": "regularuser", "password": "pass123", "role": "user"})

    # Login as regular user
    resp2 = await client.post("/auth/login", json={
        "username": "regularuser", "password": "pass123",
        "device_id": "dev2", "device_name": "Dev2",
    })
    user_token = resp2.json()["session_token"]
    client.headers["Authorization"] = f"Bearer {user_token}"

    resp3 = await client.get("/api/admin/stats")
    assert resp3.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/admin/stats/workflows
# ---------------------------------------------------------------------------

async def test_workflow_analytics(auth_client: AsyncClient, db_session: AsyncSession):
    await _seed_data(auth_client, db_session)
    resp = await auth_client.get("/api/admin/stats/workflows")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2

    # Find the active workflow with audit entries
    active = next(w for w in data["items"] if w["name"] == "Automation")
    assert active["is_active"] is True
    assert active["run_count"] == 5
    assert active["audit_entries"] == 3

    inactive = next(w for w in data["items"] if w["name"] == "Disabled WF")
    assert inactive["is_active"] is False
    assert inactive["audit_entries"] == 0


async def test_workflow_analytics_pagination(auth_client: AsyncClient, db_session: AsyncSession):
    await _seed_data(auth_client, db_session)
    resp = await auth_client.get("/api/admin/stats/workflows", params={"limit": 1, "offset": 0})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["has_more"] is True


# ---------------------------------------------------------------------------
# GET /api/admin/stats/websocket
# ---------------------------------------------------------------------------

async def test_websocket_stats_empty(auth_client: AsyncClient):
    resp = await auth_client.get("/api/admin/stats/websocket")
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected_users"] == []
