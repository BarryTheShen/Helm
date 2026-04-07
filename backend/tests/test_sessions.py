"""Tests for Session Management API (Phase 0/1)."""

import pytest

from httpx import ASGITransport, AsyncClient

from app.main import app


pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_regular_user_client(auth_client, client, username="regular", password="pass123"):
    """Create a non-admin user, log them in, return AsyncClient with their token."""
    await auth_client.post(
        "/api/users",
        json={"username": username, "password": password, "role": "user"},
    )
    login = await client.post(
        "/auth/login",
        json={
            "username": username,
            "password": password,
            "device_id": f"device-{username}",
            "device_name": f"Device {username}",
        },
    )
    token = login.json()["session_token"]
    regular = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    )
    return regular


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_list_all_sessions_admin(auth_client):
    """GET /api/sessions returns active sessions (admin only)."""
    resp = await auth_client.get("/api/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    items = data["items"]
    assert isinstance(items, list)
    assert len(items) >= 1
    session = items[0]
    assert "id" in session
    assert "user_id" in session
    assert session["is_active"] is True
    assert "device_name" in session


async def test_list_my_sessions(auth_client):
    """GET /api/sessions/me returns sessions for the current user only."""
    resp = await auth_client.get("/api/sessions/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    items = data["items"]
    assert isinstance(items, list)
    assert len(items) >= 1
    # All returned sessions belong to the admin user
    user_ids = {s["user_id"] for s in items}
    assert len(user_ids) == 1
    for s in items:
        assert s["is_active"] is True


async def test_revoke_session(auth_client, client):
    """DELETE /api/sessions/{id} sets is_active=False."""
    # Create a second user with an active session to revoke
    regular = await _create_regular_user_client(auth_client, client)
    try:
        # List all sessions as admin to find the regular user's session
        all_resp = await auth_client.get("/api/sessions")
        all_sessions = all_resp.json()["items"]
        # Find the session belonging to "regular" (not testadmin)
        regular_session = next(
            s for s in all_sessions if s.get("username") == "regular"
        )
        session_id = regular_session["id"]

        # Admin revokes the regular user's session
        resp = await auth_client.delete(f"/api/sessions/{session_id}")
        assert resp.status_code == 204

        # The regular user should now be unauthorized
        check = await regular.get("/api/sessions/me")
        assert check.status_code == 401
    finally:
        await regular.aclose()


async def test_revoke_other_sessions(auth_client, client):
    """DELETE /api/sessions/me/others keeps current session, revokes others."""
    # Log in admin on a second device to create a second session
    login2 = await client.post(
        "/auth/login",
        json={
            "username": "testadmin",
            "password": "password123",
            "device_id": "second-device",
            "device_name": "Second Device",
        },
    )
    assert login2.status_code == 200
    token2 = login2.json()["session_token"]

    # Verify admin now has >=2 active sessions
    my_sessions = await auth_client.get("/api/sessions/me")
    assert len(my_sessions.json()["items"]) >= 2

    # Revoke all other sessions (keeping auth_client's session)
    resp = await auth_client.delete("/api/sessions/me/others")
    assert resp.status_code == 204

    # auth_client's session should still work
    check = await auth_client.get("/api/sessions/me")
    assert check.status_code == 200
    remaining = check.json()["items"]
    assert len(remaining) == 1  # Only current session survives

    # The second session's token should be dead
    check2 = await client.get(
        "/api/sessions/me",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert check2.status_code == 401


async def test_non_admin_cannot_list_all_sessions(auth_client, client):
    """Regular user gets 403 on GET /api/sessions (admin-only endpoint)."""
    regular = await _create_regular_user_client(auth_client, client)
    try:
        resp = await regular.get("/api/sessions")
        assert resp.status_code == 403
    finally:
        await regular.aclose()
