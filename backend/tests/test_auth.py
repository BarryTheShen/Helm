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
