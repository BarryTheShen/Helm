"""Tests for settings endpoints (GET /api/settings, PATCH /api/settings)."""

import pytest

pytestmark = pytest.mark.anyio


async def test_get_settings_requires_auth(client):
    """GET /api/settings requires authentication."""
    resp = await client.get("/api/settings")
    assert resp.status_code == 401


async def test_get_settings_creates_default(auth_client):
    """GET /api/settings creates default settings if none exist."""
    resp = await auth_client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "user_id" in data
    assert data["dark_mode"] is False
    assert data["display_name"] is None
    assert data["email"] is None
    assert data["endpoint_url"] is None


async def test_update_settings_requires_auth(client):
    """PATCH /api/settings requires authentication."""
    resp = await client.patch(
        "/api/settings",
        json={"display_name": "Test User"},
    )
    assert resp.status_code == 401


async def test_update_settings_display_name(auth_client):
    """PATCH /api/settings updates display_name."""
    resp = await auth_client.patch(
        "/api/settings",
        json={"display_name": "John Doe"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "John Doe"

    # Verify persistence
    resp2 = await auth_client.get("/api/settings")
    assert resp2.json()["display_name"] == "John Doe"


async def test_update_settings_email(auth_client):
    """PATCH /api/settings updates email."""
    resp = await auth_client.patch(
        "/api/settings",
        json={"email": "test@example.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"


async def test_update_settings_endpoint_url(auth_client):
    """PATCH /api/settings updates endpoint_url."""
    resp = await auth_client.patch(
        "/api/settings",
        json={"endpoint_url": "https://api.example.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["endpoint_url"] == "https://api.example.com"


async def test_update_settings_dark_mode(auth_client):
    """PATCH /api/settings updates dark_mode."""
    resp = await auth_client.patch(
        "/api/settings",
        json={"dark_mode": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["dark_mode"] is True


async def test_update_settings_multiple_fields(auth_client):
    """PATCH /api/settings updates multiple fields at once."""
    resp = await auth_client.patch(
        "/api/settings",
        json={
            "display_name": "Jane Smith",
            "email": "jane@example.com",
            "dark_mode": True,
            "endpoint_url": "https://custom.api.com",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Jane Smith"
    assert data["email"] == "jane@example.com"
    assert data["dark_mode"] is True
    assert data["endpoint_url"] == "https://custom.api.com"


async def test_update_settings_partial(auth_client):
    """PATCH /api/settings allows partial updates."""
    # Set initial values
    await auth_client.patch(
        "/api/settings",
        json={"display_name": "Initial Name", "email": "initial@example.com"},
    )

    # Update only display_name
    resp = await auth_client.patch(
        "/api/settings",
        json={"display_name": "Updated Name"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Updated Name"
    assert data["email"] == "initial@example.com"  # Should remain unchanged


async def test_settings_save_action(auth_client):
    """Test settings.save action via action registry."""
    resp = await auth_client.post(
        "/api/actions/execute",
        json={
            "function": "settings.save",
            "params": {
                "display_name": "Action Test",
                "email": "action@example.com",
                "dark_mode": True,
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["result"]["status"] == "ok"
    assert data["result"]["settings"]["display_name"] == "Action Test"
    assert data["result"]["settings"]["email"] == "action@example.com"
    assert data["result"]["settings"]["dark_mode"] is True

    # Verify via GET endpoint
    resp2 = await auth_client.get("/api/settings")
    assert resp2.json()["display_name"] == "Action Test"
