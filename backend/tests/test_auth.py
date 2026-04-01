"""Tests for authentication endpoints."""

import pytest


pytestmark = pytest.mark.anyio


async def test_status_before_setup(client):
    resp = await client.get("/auth/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["setup_complete"] is False


async def test_setup_creates_user(client):
    resp = await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "user_id" in data


async def test_setup_idempotent(client):
    """Second setup call must be rejected once a user exists."""
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    resp = await client.post(
        "/auth/setup",
        json={"username": "admin2", "password": "secret456"},
    )
    assert resp.status_code == 409


async def test_status_after_setup(client):
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    resp = await client.get("/auth/status")
    assert resp.status_code == 200
    assert resp.json()["setup_complete"] is True


async def test_login_returns_token(client):
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "secret123",
            "device_id": "dev-001",
            "device_name": "My Phone",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "session_token" in data
    assert "user_id" in data


async def test_login_wrong_password(client):
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "wrongpass",
            "device_id": "dev-001",
            "device_name": "My Phone",
        },
    )
    assert resp.status_code == 401


async def test_logout(auth_client):
    resp = await auth_client.post("/auth/logout")
    assert resp.status_code == 200
    # Token should be invalidated — subsequent protected request fails
    resp2 = await auth_client.get("/api/notifications")
    assert resp2.status_code == 401


async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_repeated_login_same_device(client):
    """Logging in again on the same device should succeed and invalidate old session."""
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    # First login
    resp1 = await client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "secret123",
            "device_id": "web",
            "device_name": "Web Browser",
        },
    )
    assert resp1.status_code == 200
    token1 = resp1.json()["session_token"]

    # Second login (same device, no logout first)
    resp2 = await client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "secret123",
            "device_id": "web",
            "device_name": "Web Browser",
        },
    )
    assert resp2.status_code == 200
    token2 = resp2.json()["session_token"]
    assert token1 != token2

    # Old token should be invalidated
    resp3 = await client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert resp3.status_code == 401

    # New token should work
    resp4 = await client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert resp4.status_code == 200


async def test_login_after_logout(client):
    """Login should work after logging out."""
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    # Login
    resp = await client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "secret123",
            "device_id": "web",
            "device_name": "Web Browser",
        },
    )
    assert resp.status_code == 200
    token = resp.json()["session_token"]

    # Logout
    resp = await client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Login again
    resp = await client.post(
        "/auth/login",
        json={
            "username": "admin",
            "password": "secret123",
            "device_id": "web",
            "device_name": "Web Browser",
        },
    )
    assert resp.status_code == 200
    assert "session_token" in resp.json()


async def test_refresh_preserves_device(auth_client):
    """Token refresh should create a valid session with correct device."""
    resp = await auth_client.post("/auth/refresh")
    assert resp.status_code == 200
    new_token = resp.json()["session_token"]

    # New token should work for protected endpoints
    resp2 = await auth_client.get(
        "/api/notifications",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert resp2.status_code == 200


async def test_login_wrong_username(client):
    """Login with non-existent username returns 401."""
    await client.post(
        "/auth/setup",
        json={"username": "admin", "password": "secret123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "nonexistent",
            "password": "secret123",
            "device_id": "web",
            "device_name": "Web Browser",
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"
