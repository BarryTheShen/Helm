"""Tests for User Management API (Phase 0/1)."""

import pytest

from httpx import ASGITransport, AsyncClient

from app.main import app


pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_regular_user(auth_client, client, username="regular", password="pass123"):
    """Create a non-admin user via admin endpoint, log them in, return an
    AsyncClient with their token set."""
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
    # Build a fresh client sharing the same transport so headers don't leak
    regular = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    )
    return regular


async def _get_admin_user_id(auth_client):
    """Return the user id of the logged-in admin."""
    resp = await auth_client.get("/api/users")
    users = resp.json()["items"]
    return users[0]["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_list_users(auth_client):
    """GET /api/users returns at least the setup admin user."""
    resp = await auth_client.get("/api/users")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "has_more" in data
    items = data["items"]
    assert isinstance(items, list)
    assert len(items) >= 1
    assert items[0]["username"] == "testadmin"
    assert items[0]["role"] == "admin"


async def test_create_user(auth_client):
    """POST /api/users creates a new user with role 'user'."""
    resp = await auth_client.post(
        "/api/users",
        json={"username": "newuser", "password": "secret", "role": "user"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "newuser"
    assert data["role"] == "user"
    assert "id" in data
    assert "created_at" in data


async def test_create_user_duplicate_username(auth_client):
    """POST /api/users with existing username returns 409."""
    await auth_client.post(
        "/api/users",
        json={"username": "dupuser", "password": "pw1", "role": "user"},
    )
    resp = await auth_client.post(
        "/api/users",
        json={"username": "dupuser", "password": "pw2", "role": "user"},
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"].lower()


async def test_get_user_detail(auth_client):
    """GET /api/users/{id} returns user with device_count and active_session_count."""
    admin_id = await _get_admin_user_id(auth_client)
    resp = await auth_client.get(f"/api/users/{admin_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == admin_id
    assert data["username"] == "testadmin"
    assert "device_count" in data
    assert "active_session_count" in data
    assert isinstance(data["device_count"], int)
    assert isinstance(data["active_session_count"], int)
    # The admin logged in during fixture setup, so at least 1 active session
    assert data["active_session_count"] >= 1


async def test_update_user(auth_client):
    """PUT /api/users/{id} updates username, verify change persists."""
    create = await auth_client.post(
        "/api/users",
        json={"username": "toupdate", "password": "pw", "role": "user"},
    )
    user_id = create.json()["id"]

    resp = await auth_client.put(
        f"/api/users/{user_id}",
        json={"username": "updated_name"},
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "updated_name"

    # Verify persistence via GET
    detail = await auth_client.get(f"/api/users/{user_id}")
    assert detail.json()["username"] == "updated_name"


async def test_update_user_cannot_demote_self(auth_client):
    """PUT /api/users/{own_id} with role='user' returns 400."""
    admin_id = await _get_admin_user_id(auth_client)
    resp = await auth_client.put(
        f"/api/users/{admin_id}",
        json={"role": "user"},
    )
    assert resp.status_code == 400
    assert "demote" in resp.json()["detail"].lower()


async def test_delete_user(auth_client):
    """DELETE /api/users/{other_id} returns 204 and removes the user."""
    create = await auth_client.post(
        "/api/users",
        json={"username": "deleteme", "password": "pw", "role": "user"},
    )
    user_id = create.json()["id"]

    resp = await auth_client.delete(f"/api/users/{user_id}")
    assert resp.status_code == 204

    # Verify user is gone
    detail = await auth_client.get(f"/api/users/{user_id}")
    assert detail.status_code == 404


async def test_delete_user_cannot_delete_self(auth_client):
    """DELETE /api/users/{own_id} returns 400."""
    admin_id = await _get_admin_user_id(auth_client)
    resp = await auth_client.delete(f"/api/users/{admin_id}")
    assert resp.status_code == 400
    assert "yourself" in resp.json()["detail"].lower()


async def test_users_require_admin(auth_client, client):
    """Regular user (non-admin) gets 403 on user management endpoints."""
    regular = await _create_regular_user(auth_client, client)
    try:
        resp_list = await regular.get("/api/users")
        assert resp_list.status_code == 403

        resp_create = await regular.post(
            "/api/users",
            json={"username": "nope", "password": "pw", "role": "user"},
        )
        assert resp_create.status_code == 403

        admin_id = await _get_admin_user_id(auth_client)
        resp_detail = await regular.get(f"/api/users/{admin_id}")
        assert resp_detail.status_code == 403

        resp_update = await regular.put(
            f"/api/users/{admin_id}",
            json={"username": "hacked"},
        )
        assert resp_update.status_code == 403

        resp_delete = await regular.delete(f"/api/users/{admin_id}")
        assert resp_delete.status_code == 403
    finally:
        await regular.aclose()


async def test_search_users(auth_client):
    """GET /api/users?search=partial matches by username."""
    await auth_client.post(
        "/api/users",
        json={"username": "alice_test", "password": "pw", "role": "user"},
    )
    await auth_client.post(
        "/api/users",
        json={"username": "bob_test", "password": "pw", "role": "user"},
    )

    resp = await auth_client.get("/api/users", params={"search": "alice"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["username"] == "alice_test"

    # Search that matches multiple
    resp2 = await auth_client.get("/api/users", params={"search": "_test"})
    assert resp2.status_code == 200
    assert len(resp2.json()["items"]) == 2
