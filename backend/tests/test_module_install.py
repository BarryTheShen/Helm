"""Tests for Module Install / Uninstall API (Phase 4c)."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.models.module_instance import ModuleInstance

pytestmark = pytest.mark.anyio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_template(auth_client: AsyncClient) -> str:
    """Create a minimal SDUITemplate via the admin templates API and return its id."""
    resp = await auth_client.post(
        "/api/templates",
        json={
            "name": "Test Template",
            "description": "A test template",
            "category": "custom",
            "screen_json": {"title": "Test", "sections": []},
            "is_public": True,
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


async def _create_second_user_client(auth_client, client, username="other_user"):
    """Create a second non-admin user and return an authenticated client."""
    await auth_client.post(
        "/api/users",
        json={"username": username, "password": "pass999", "role": "user"},
    )
    login = await client.post(
        "/auth/login",
        json={
            "username": username,
            "password": "pass999",
            "device_id": f"device-{username}",
            "device_name": f"Device {username}",
        },
    )
    token = login.json()["session_token"]
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {token}"},
    )


# ---------------------------------------------------------------------------
# Install tests
# ---------------------------------------------------------------------------

async def test_install_creates_module_instance(auth_client, db_session):
    """POST /api/modules/install creates a ModuleInstance row and returns correct shape."""
    template_id = await _create_template(auth_client)

    resp = await auth_client.post(
        "/api/modules/install",
        json={"template_id": template_id, "name": "My Test Module"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["template_id"] == template_id
    assert data["name"] == "My Test Module"
    assert data["status"] == "active"
    assert "id" in data
    assert "installed_at" in data

    # Verify the row actually exists in the DB
    result = await db_session.execute(
        select(ModuleInstance).where(ModuleInstance.id == data["id"])
    )
    instance = result.scalar_one_or_none()
    assert instance is not None
    assert instance.template_id == template_id


async def test_install_defaults_name_to_template_name(auth_client):
    """POST /api/modules/install without a name uses the template's name."""
    template_id = await _create_template(auth_client)

    resp = await auth_client.post(
        "/api/modules/install",
        json={"template_id": template_id},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "Test Template"


async def test_install_missing_template_returns_404(auth_client):
    """POST /api/modules/install with a non-existent template_id returns 404."""
    resp = await auth_client.post(
        "/api/modules/install",
        json={"template_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 404


async def test_install_broadcasts_ws_event(auth_client):
    """POST /api/modules/install calls ws_manager.send with module.installed."""
    template_id = await _create_template(auth_client)

    with patch(
        "app.routers.module_instances.ws_manager.send", new_callable=AsyncMock
    ) as mock_send:
        resp = await auth_client.post(
            "/api/modules/install",
            json={"template_id": template_id, "name": "WS Test"},
        )
        assert resp.status_code == 201
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        message = call_args[0][1]  # second positional arg is the message dict
        assert message["type"] == "module.installed"
        assert message["data"]["template_id"] == template_id


# ---------------------------------------------------------------------------
# Uninstall tests
# ---------------------------------------------------------------------------

async def test_uninstall_own_instance_returns_204(auth_client, db_session):
    """DELETE /api/modules/instances/{id} removes the row and returns 204."""
    template_id = await _create_template(auth_client)

    install_resp = await auth_client.post(
        "/api/modules/install",
        json={"template_id": template_id},
    )
    instance_id = install_resp.json()["id"]

    del_resp = await auth_client.delete(f"/api/modules/instances/{instance_id}")
    assert del_resp.status_code == 204

    # Row must be gone
    result = await db_session.execute(
        select(ModuleInstance).where(ModuleInstance.id == instance_id)
    )
    assert result.scalar_one_or_none() is None


async def test_uninstall_nonexistent_returns_404(auth_client):
    """DELETE /api/modules/instances/{id} with unknown id returns 404."""
    resp = await auth_client.delete(
        "/api/modules/instances/00000000-0000-0000-0000-000000000000"
    )
    assert resp.status_code == 404


async def test_uninstall_someone_elses_instance_returns_403(auth_client, client):
    """DELETE /api/modules/instances/{id} returns 403 when the instance belongs to another user."""
    template_id = await _create_template(auth_client)

    install_resp = await auth_client.post(
        "/api/modules/install",
        json={"template_id": template_id},
    )
    instance_id = install_resp.json()["id"]

    other = await _create_second_user_client(auth_client, client)
    try:
        resp = await other.delete(f"/api/modules/instances/{instance_id}")
        assert resp.status_code == 403
    finally:
        await other.aclose()


async def test_uninstall_broadcasts_ws_event(auth_client):
    """DELETE /api/modules/instances/{id} calls ws_manager.send with module.uninstalled."""
    template_id = await _create_template(auth_client)
    install_resp = await auth_client.post(
        "/api/modules/install",
        json={"template_id": template_id},
    )
    instance_id = install_resp.json()["id"]

    with patch(
        "app.routers.module_instances.ws_manager.send", new_callable=AsyncMock
    ) as mock_send:
        resp = await auth_client.delete(f"/api/modules/instances/{instance_id}")
        assert resp.status_code == 204
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        message = call_args[0][1]
        assert message["type"] == "module.uninstalled"
        assert message["data"]["instance_id"] == instance_id
