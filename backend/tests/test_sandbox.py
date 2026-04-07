"""Tests for sandbox mode (X-Helm-Sandbox header) and auto-approve config."""

import pytest

pytestmark = pytest.mark.anyio


# ── Sandbox Mode: DB rollback ─────────────────────────────────────────────

async def test_sandbox_request_does_not_persist(auth_client):
    """In sandbox mode, POST /api/sdui/{module_id} should return 200 but not persist."""
    # Enable auto-approve so the screen would go live if not sandboxed
    await auth_client.put("/api/sdui/sandbox_test/config", json={"auto_approve_drafts": True})

    # Set screen in sandbox mode
    auth_client.headers["X-Helm-Sandbox"] = "true"
    auth_client.headers["X-Helm-Sandbox-Session"] = "test-session-1"
    resp = await auth_client.post(
        "/api/sdui/sandbox_test",
        json={"screen": {"title": "Sandbox Screen", "sections": []}},
    )
    assert resp.status_code == 200

    # Remove sandbox header and check: screen should NOT exist
    del auth_client.headers["X-Helm-Sandbox"]
    del auth_client.headers["X-Helm-Sandbox-Session"]
    resp = await auth_client.get("/api/sdui/sandbox_test")
    assert resp.json()["screen"] is None


async def test_sandbox_calendar_event_not_persisted(auth_client):
    """Calendar event created in sandbox mode should not persist."""
    auth_client.headers["X-Helm-Sandbox"] = "true"
    resp = await auth_client.post(
        "/api/calendar/events",
        json={
            "title": "Sandbox Meeting",
            "start_time": "2026-04-10T10:00:00",
            "end_time": "2026-04-10T11:00:00",
        },
    )
    assert resp.status_code == 201

    # Verify event not persisted
    del auth_client.headers["X-Helm-Sandbox"]
    resp = await auth_client.get("/api/calendar/events")
    events = resp.json()["events"]
    sandbox_events = [e for e in events if e["title"] == "Sandbox Meeting"]
    assert len(sandbox_events) == 0


async def test_non_sandbox_request_persists(auth_client):
    """Normal requests (no sandbox header) should still persist."""
    await auth_client.put("/api/sdui/persist_test/config", json={"auto_approve_drafts": True})
    resp = await auth_client.post(
        "/api/sdui/persist_test",
        json={"screen": {"title": "Real Screen", "sections": []}},
    )
    assert resp.status_code == 200

    resp = await auth_client.get("/api/sdui/persist_test")
    assert resp.json()["screen"]["title"] == "Real Screen"


# ── Auto-Approve Toggle ───────────────────────────────────────────────────

async def test_get_module_config_default(auth_client):
    """Default config should have auto_approve_drafts=False."""
    resp = await auth_client.get("/api/sdui/newmod/config")
    assert resp.status_code == 200
    assert resp.json()["auto_approve_drafts"] is False


async def test_set_module_config(auth_client):
    """Setting auto_approve_drafts to True should persist."""
    resp = await auth_client.put(
        "/api/sdui/cfgmod/config",
        json={"auto_approve_drafts": True},
    )
    assert resp.status_code == 200
    assert resp.json()["auto_approve_drafts"] is True

    # Verify it persisted
    resp = await auth_client.get("/api/sdui/cfgmod/config")
    assert resp.json()["auto_approve_drafts"] is True


async def test_auto_approve_true_sets_live(auth_client):
    """With auto_approve_drafts=True, POST /api/sdui creates a live screen (no draft)."""
    await auth_client.put("/api/sdui/automod/config", json={"auto_approve_drafts": True})

    resp = await auth_client.post(
        "/api/sdui/automod",
        json={"screen": {"title": "Auto Screen", "sections": []}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "draft" not in data or data.get("draft") is not True

    # Live screen should exist
    resp = await auth_client.get("/api/sdui/automod")
    assert resp.json()["screen"]["title"] == "Auto Screen"


async def test_auto_approve_false_creates_draft(auth_client):
    """With auto_approve_drafts=False (default), POST /api/sdui creates a draft."""
    resp = await auth_client.post(
        "/api/sdui/draftmod",
        json={"screen": {"title": "Draft Screen", "sections": []}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["draft"] is True

    # No live screen
    resp = await auth_client.get("/api/sdui/draftmod")
    assert resp.json()["screen"] is None

    # Draft should exist
    resp = await auth_client.get("/api/sdui/draftmod/draft")
    assert resp.json()["has_draft"] is True
    assert resp.json()["screen"]["title"] == "Draft Screen"


async def test_config_requires_auth(client):
    """Config endpoints require authentication."""
    resp = await client.get("/api/sdui/mod/config")
    assert resp.status_code == 401
    resp = await client.put("/api/sdui/mod/config", json={"auto_approve_drafts": True})
    assert resp.status_code == 401
