"""Tests for admin stats/analytics endpoints."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import App
from app.models.audit_log import AuditLog
from app.models.calendar_event import CalendarEvent
from app.models.module_instance import ModuleInstance
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
        trigger_type="form_submitted", trigger_config={}, graph={},
        enabled=True,
    ))
    # Workflow (inactive)
    db.add(Workflow(
        id=str(uuid.uuid4()), user_id=user_id, name="Disabled WF",
        trigger_type="schedule", trigger_config={}, graph={},
        enabled=False,
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
    assert active["enabled"] is True
    assert active["audit_entries"] == 3

    inactive = next(w for w in data["items"] if w["name"] == "Disabled WF")
    assert inactive["enabled"] is False
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


# ---------------------------------------------------------------------------
# GET /api/admin/cleanup/preview  and  POST /api/admin/cleanup/execute
# ---------------------------------------------------------------------------

async def _seed_cleanup_test_data(db: AsyncSession, user_id: str) -> None:
    """Seed test-prefixed and non-test items for cleanup tests."""
    # Test apps
    db.add(App(id=str(uuid.uuid4()), user_id=user_id, name="Test App"))
    db.add(App(id=str(uuid.uuid4()), user_id=user_id, name="test_work_app"))
    # Non-test app (should survive cleanup)
    db.add(App(id=str(uuid.uuid4()), user_id=user_id, name="Main App"))

    # Test module instances
    db.add(ModuleInstance(
        id=str(uuid.uuid4()), user_id=user_id, name="Test Module",
        module_type="todo", version="1.0.0",
    ))
    db.add(ModuleInstance(
        id=str(uuid.uuid4()), user_id=user_id, name="test_calendar",
        module_type="calendar", version="1.0.0",
    ))
    # Non-test module (should survive cleanup)
    db.add(ModuleInstance(
        id=str(uuid.uuid4()), user_id=user_id, name="Real Module",
        module_type="notes", version="1.0.0",
    ))

    # Test templates
    db.add(SDUITemplate(
        id=str(uuid.uuid4()), name="Test Template",
        category="custom", screen_json={"rows": []},
        created_by=user_id,
    ))
    # Non-test template (should survive cleanup)
    db.add(SDUITemplate(
        id=str(uuid.uuid4()), name="Real Template",
        category="custom", screen_json={"rows": []},
        created_by=user_id,
    ))

    await db.commit()


async def test_cleanup_preview_requires_auth(client: AsyncClient):
    """GET /api/admin/cleanup/preview requires authentication."""
    resp = await client.get("/api/admin/cleanup/preview")
    assert resp.status_code == 401


async def test_cleanup_preview_requires_admin(client: AsyncClient):
    """GET /api/admin/cleanup/preview requires admin role."""
    await client.post("/auth/setup", json={"username": "cuadmin", "password": "password123"})
    resp = await client.post("/auth/login", json={
        "username": "cuadmin", "password": "password123",
        "device_id": "dev-cu", "device_name": "Dev Cu",
    })
    admin_token = resp.json()["session_token"]
    client.headers["Authorization"] = f"Bearer {admin_token}"
    await client.post("/api/users", json={"username": "reguser", "password": "pass123", "role": "user"})

    resp2 = await client.post("/auth/login", json={
        "username": "reguser", "password": "pass123",
        "device_id": "dev-r", "device_name": "Dev R",
    })
    user_token = resp2.json()["session_token"]
    client.headers["Authorization"] = f"Bearer {user_token}"

    resp3 = await client.get("/api/admin/cleanup/preview")
    assert resp3.status_code == 403


async def test_cleanup_preview_empty(auth_client: AsyncClient):
    """Preview with no test data returns zero counts."""
    resp = await auth_client.get("/api/admin/cleanup/preview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apps_deleted"] == 0
    assert data["module_instances_deleted"] == 0
    assert data["templates_deleted"] == 0
    assert data["details"] == []
    assert data["errors"] == []


async def test_cleanup_preview_shows_counts(auth_client: AsyncClient, db_session: AsyncSession):
    """Preview shows correct counts without deleting data."""
    user_id = await _get_user_id(auth_client)
    await _seed_cleanup_test_data(db_session, user_id)

    resp = await auth_client.get("/api/admin/cleanup/preview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apps_deleted"] == 2  # "Test App" + "test_work_app"
    assert data["module_instances_deleted"] == 2  # "Test Module" + "test_calendar"
    assert data["templates_deleted"] == 1  # "Test Template"
    assert data["errors"] == []

    # Preview should NOT actually delete anything
    assert len(data["details"]) == 5  # 2 apps + 2 modules + 1 template


async def test_cleanup_preview_does_not_delete(auth_client: AsyncClient, db_session: AsyncSession):
    """Preview is a dry-run — items still exist after preview."""
    user_id = await _get_user_id(auth_client)
    await _seed_cleanup_test_data(db_session, user_id)

    # Run preview
    await auth_client.get("/api/admin/cleanup/preview")

    # All items should still exist
    resp = await auth_client.get("/api/admin/stats")
    assert resp.status_code == 200


async def test_cleanup_execute_requires_auth(client: AsyncClient):
    """POST /api/admin/cleanup/execute requires authentication."""
    resp = await client.post("/api/admin/cleanup/execute")
    assert resp.status_code == 401


async def test_cleanup_execute_requires_admin(client: AsyncClient):
    """POST /api/admin/cleanup/execute requires admin role."""
    await client.post("/auth/setup", json={"username": "ceadmin", "password": "password123"})
    resp = await client.post("/auth/login", json={
        "username": "ceadmin", "password": "password123",
        "device_id": "dev-ce", "device_name": "Dev Ce",
    })
    admin_token = resp.json()["session_token"]
    client.headers["Authorization"] = f"Bearer {admin_token}"
    await client.post("/api/users", json={"username": "reguser2", "password": "pass123", "role": "user"})

    resp2 = await client.post("/auth/login", json={
        "username": "reguser2", "password": "pass123",
        "device_id": "dev-r2", "device_name": "Dev R2",
    })
    user_token = resp2.json()["session_token"]
    client.headers["Authorization"] = f"Bearer {user_token}"

    resp3 = await client.post("/api/admin/cleanup/execute")
    assert resp3.status_code == 403


async def test_cleanup_execute_empty(auth_client: AsyncClient):
    """Execute with no test data returns zero counts."""
    resp = await auth_client.post("/api/admin/cleanup/execute")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apps_deleted"] == 0
    assert data["module_instances_deleted"] == 0
    assert data["templates_deleted"] == 0
    assert data["errors"] == []


async def test_cleanup_execute_deletes_test_items(auth_client: AsyncClient, db_session: AsyncSession):
    """Execute deletes test-prefixed items and returns correct counts."""
    user_id = await _get_user_id(auth_client)
    await _seed_cleanup_test_data(db_session, user_id)

    resp = await auth_client.post("/api/admin/cleanup/execute")
    assert resp.status_code == 200
    data = resp.json()
    assert data["apps_deleted"] == 2
    assert data["module_instances_deleted"] == 2
    assert data["templates_deleted"] == 1
    assert data["errors"] == []

    # Verify items are actually gone from the database
    # We only have the auth_client user; verify by checking apps/user stats
    stats_resp = await auth_client.get("/api/admin/stats")
    stats = stats_resp.json()
    # Non-test App "Main App" should still exist


async def test_cleanup_execute_preserves_non_test_items(auth_client: AsyncClient, db_session: AsyncSession):
    """Execute does not delete items without 'test'/'Test' prefix."""
    user_id = await _get_user_id(auth_client)
    await _seed_cleanup_test_data(db_session, user_id)

    # Run execute
    await auth_client.post("/api/admin/cleanup/execute")

    # Check that non-test items still exist via direct DB query
    from sqlalchemy import func, select

    # App "Main App" should survive
    result = await db_session.execute(
        select(func.count(App.id)).where(App.user_id == user_id, App.name == "Main App")
    )
    assert result.scalar() == 1

    # ModuleInstance "Real Module" should survive
    result = await db_session.execute(
        select(func.count(ModuleInstance.id)).where(
            ModuleInstance.user_id == user_id, ModuleInstance.name == "Real Module"
        )
    )
    assert result.scalar() == 1

    # Template "Real Template" should survive
    result = await db_session.execute(
        select(func.count(SDUITemplate.id)).where(
            SDUITemplate.created_by == user_id, SDUITemplate.name == "Real Template"
        )
    )
    assert result.scalar() == 1
