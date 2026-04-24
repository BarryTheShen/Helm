"""Tests for device registration and management endpoints."""

import pytest


pytestmark = pytest.mark.anyio

DEVICES = "/api/devices"


async def test_list_devices_empty(auth_client):
    """List devices when none exist (except the auth device)."""
    resp = await auth_client.get(DEVICES)
    assert resp.status_code == 200
    data = resp.json()
    # auth_client creates a device during login, so we expect 1 device
    assert len(data) == 1
    assert data[0]["device_id"] == "test-device-001"


async def test_devices_requires_auth(client):
    """Devices endpoints require authentication."""
    resp = await client.get(DEVICES)
    assert resp.status_code == 401


async def test_register_device(auth_client):
    """Register a new device."""
    resp = await auth_client.post(
        DEVICES,
        json={
            "device_id": "device-uuid-123",
            "device_name": "iPhone 15 Pro",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["device_id"] == "device-uuid-123"
    assert data["device_name"] == "iPhone 15 Pro"
    assert data["config_json"] == {}
    assert data["assigned_app_id"] is None
    assert "id" in data
    assert "user_id" in data
    assert "last_seen" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_register_device_idempotent(auth_client):
    """Registering same device_id updates last_seen instead of creating duplicate."""
    # First registration
    resp1 = await auth_client.post(
        DEVICES,
        json={
            "device_id": "device-uuid-456",
            "device_name": "iPad Pro",
        },
    )
    assert resp1.status_code == 201
    device_id_1 = resp1.json()["id"]
    last_seen_1 = resp1.json()["last_seen"]

    # Second registration with same device_id
    resp2 = await auth_client.post(
        DEVICES,
        json={
            "device_id": "device-uuid-456",
            "device_name": "iPad Pro Updated",
        },
    )
    assert resp2.status_code == 201
    device_id_2 = resp2.json()["id"]
    last_seen_2 = resp2.json()["last_seen"]

    # Should return same device with updated last_seen
    assert device_id_1 == device_id_2
    assert last_seen_2 >= last_seen_1


async def test_list_devices_after_register(auth_client):
    """List devices returns registered devices."""
    await auth_client.post(
        DEVICES,
        json={"device_id": "device-1", "device_name": "Device 1"},
    )
    await auth_client.post(
        DEVICES,
        json={"device_id": "device-2", "device_name": "Device 2"},
    )

    resp = await auth_client.get(DEVICES)
    assert resp.status_code == 200
    data = resp.json()
    # 3 devices: 1 from auth_client + 2 registered
    assert len(data) == 3
    device_names = [d["device_name"] for d in data]
    assert "Device 1" in device_names
    assert "Device 2" in device_names


async def test_get_device_by_id(auth_client):
    """Get device by ID."""
    register_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-uuid-789", "device_name": "Test Device"},
    )
    device_id = register_resp.json()["id"]

    resp = await auth_client.get(f"{DEVICES}/{device_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == device_id
    assert data["device_name"] == "Test Device"


async def test_get_device_not_found(auth_client):
    """Get device returns 404 for non-existent ID."""
    resp = await auth_client.get(f"{DEVICES}/nonexistent-id")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Device not found"


async def test_unregister_device(auth_client):
    """Unregister (delete) a device."""
    register_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-to-delete", "device_name": "To Delete"},
    )
    device_id = register_resp.json()["id"]

    resp = await auth_client.delete(f"{DEVICES}/{device_id}")
    assert resp.status_code == 204

    # Verify device is deleted
    list_resp = await auth_client.get(DEVICES)
    ids = [device["id"] for device in list_resp.json()]
    assert device_id not in ids


async def test_unregister_device_not_found(auth_client):
    """Unregister device returns 404 for non-existent ID."""
    resp = await auth_client.delete(f"{DEVICES}/nonexistent-id")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Device not found"


# ── App Assignment Tests ───────────────────────────────────────────────────


async def test_assign_app_to_device(auth_client):
    """Assign an app to a device."""
    # Create app
    app_resp = await auth_client.post("/api/apps", json={"name": "Test App"})
    app_id = app_resp.json()["id"]

    # Register device
    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-123", "device_name": "Test Device"},
    )
    device_id = device_resp.json()["id"]

    # Assign app to device
    resp = await auth_client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": app_id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["assigned_app_id"] == app_id


async def test_assign_app_device_not_found(auth_client):
    """Assign app returns 404 if device not found."""
    # Create app
    app_resp = await auth_client.post("/api/apps", json={"name": "Test App"})
    app_id = app_resp.json()["id"]

    resp = await auth_client.put(
        f"{DEVICES}/nonexistent-device/app",
        json={"app_id": app_id},
    )
    assert resp.status_code == 404


async def test_assign_app_app_not_found(auth_client):
    """Assign app returns 404 if app not found."""
    # Register device
    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-123", "device_name": "Test Device"},
    )
    device_id = device_resp.json()["id"]

    resp = await auth_client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": "nonexistent-app"},
    )
    assert resp.status_code == 404


async def test_assign_app_unauthorized(client, db_session):
    """Cannot assign another user's app to device."""
    from app.models.user import User
    from app.models.app import App
    from app.utils.security import hash_password

    # Create two users
    user1 = User(
        id="user-1",
        username="user1",
        password_hash=hash_password("password123"),
        role="user",
    )
    user2 = User(
        id="user-2",
        username="user2",
        password_hash=hash_password("password123"),
        role="user",
    )
    db_session.add(user1)
    db_session.add(user2)
    await db_session.commit()

    # Create app for user1
    app = App(
        id="app-1",
        user_id="user-1",
        name="User 1 App",
        theme={},
        design_tokens={},
        dark_mode=False,
        bottom_bar_config=[],
        launchpad_config=[],
    )
    db_session.add(app)
    await db_session.commit()

    # Login as user2
    await client.post(
        "/auth/setup",
        json={"username": "user2", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "user2",
            "password": "password123",
            "device_id": "device-2",
            "device_name": "Device 2",
        },
    )
    token = resp.json()["session_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})

    # Register device for user2
    device_resp = await client.post(
        DEVICES,
        json={"device_id": "device-uuid-2", "device_name": "User 2 Device"},
    )
    device_id = device_resp.json()["id"]

    # Try to assign user1's app to user2's device
    resp = await client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": "app-1"},
    )
    assert resp.status_code == 404


# ── Device Config Tests ────────────────────────────────────────────────────


async def test_get_device_config_no_app(auth_client):
    """Get device config returns 404 if no app assigned."""
    # Register device
    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-123", "device_name": "Test Device"},
    )
    device_id = device_resp.json()["id"]

    resp = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert resp.status_code == 404
    assert "no app assigned" in resp.json()["detail"]


async def test_get_device_config_with_app(auth_client):
    """Get device config returns full app configuration."""
    # Create app
    app_resp = await auth_client.post(
        "/api/apps",
        json={
            "name": "Test App",
            "icon": "icon.png",
            "theme": {"primary": "#007AFF"},
            "dark_mode": True,
        },
    )
    app_id = app_resp.json()["id"]

    # Register device
    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-123", "device_name": "Test Device"},
    )
    device_id = device_resp.json()["id"]

    # Assign app to device
    await auth_client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": app_id},
    )

    # Get device config
    resp = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert resp.status_code == 200
    data = resp.json()
    assert data["app_id"] == app_id
    assert data["name"] == "Test App"
    assert data["icon"] == "icon.png"
    assert data["theme"] == {"primary": "#007AFF"}
    assert data["dark_mode"] is True
    assert "bottom_bar_config" in data
    assert "launchpad_config" in data


async def test_get_device_config_enriched_bottom_bar(auth_client, db_session):
    """Get device config returns enriched bottom bar with module metadata."""
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from app.models.app_module_ref import AppModuleRef
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    # Create module instance
    module = ModuleInstance(
        id="module-1",
        user_id=user.id,
        module_type="chat",
        name="Chat Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    # Create app with bottom bar config
    app_resp = await auth_client.post(
        "/api/apps",
        json={
            "name": "Test App",
            "bottom_bar_config": [
                {"module_instance_id": "module-1", "slot_position": 0}
            ],
        },
    )
    app_id = app_resp.json()["id"]

    # Create AppModuleRef
    ref = AppModuleRef(
        id="ref-1",
        app_id=app_id,
        module_instance_id="module-1",
    )
    db_session.add(ref)
    await db_session.commit()

    # Register device
    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-123", "device_name": "Test Device"},
    )
    device_id = device_resp.json()["id"]

    # Assign app to device
    await auth_client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": app_id},
    )

    # Get device config
    resp = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["bottom_bar_config"]) == 1
    config_item = data["bottom_bar_config"][0]
    assert config_item["module_instance_id"] == "module-1"
    assert config_item["module_type"] == "chat"
    assert config_item["name"] == "Chat Module"
    assert config_item["slot_position"] == 0
    assert "icon" in config_item


async def test_get_device_config_enriched_launchpad(auth_client, db_session):
    """Get device config returns enriched launchpad with module metadata."""
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from app.models.app_module_ref import AppModuleRef
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    # Create module instances
    module1 = ModuleInstance(
        id="module-1",
        user_id=user.id,
        module_type="chat",
        name="Chat Module",
        status="active",
    )
    module2 = ModuleInstance(
        id="module-2",
        user_id=user.id,
        module_type="calendar",
        name="Calendar Module",
        status="active",
    )
    db_session.add(module1)
    db_session.add(module2)
    await db_session.commit()

    # Create app with launchpad config
    app_resp = await auth_client.post(
        "/api/apps",
        json={
            "name": "Test App",
            "launchpad_config": ["module-1", "module-2"],
        },
    )
    app_id = app_resp.json()["id"]

    # Create AppModuleRefs
    ref1 = AppModuleRef(
        id="ref-1",
        app_id=app_id,
        module_instance_id="module-1",
    )
    ref2 = AppModuleRef(
        id="ref-2",
        app_id=app_id,
        module_instance_id="module-2",
    )
    db_session.add(ref1)
    db_session.add(ref2)
    await db_session.commit()

    # Register device
    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "device-123", "device_name": "Test Device"},
    )
    device_id = device_resp.json()["id"]

    # Assign app to device
    await auth_client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": app_id},
    )

    # Get device config
    resp = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["launchpad_config"]) == 2
    assert data["launchpad_config"][0]["module_instance_id"] == "module-1"
    assert data["launchpad_config"][0]["module_type"] == "chat"
    assert data["launchpad_config"][0]["name"] == "Chat Module"
    assert data["launchpad_config"][1]["module_instance_id"] == "module-2"
    assert data["launchpad_config"][1]["module_type"] == "calendar"
    assert data["launchpad_config"][1]["name"] == "Calendar Module"


async def test_get_device_config_device_not_found(auth_client):
    """Get device config returns 404 if device not found."""
    resp = await auth_client.get(f"{DEVICES}/nonexistent-device/config")
    assert resp.status_code == 404


# ── Authorization Tests ────────────────────────────────────────────────────


async def test_user_cannot_access_other_users_devices(client, db_session):
    """Users can only access their own devices."""
    from app.models.user import User
    from app.models.device import Device
    from app.utils.security import hash_password

    # Create two users
    user1 = User(
        id="user-1",
        username="user1",
        password_hash=hash_password("password123"),
        role="user",
    )
    user2 = User(
        id="user-2",
        username="user2",
        password_hash=hash_password("password123"),
        role="user",
    )
    db_session.add(user1)
    db_session.add(user2)
    await db_session.commit()

    # Create device for user1
    device = Device(
        id="device-1",
        user_id="user-1",
        device_id="device-uuid-1",
        device_name="User 1 Device",
        config_json={},
    )
    db_session.add(device)
    await db_session.commit()

    # Login as user2
    await client.post(
        "/auth/setup",
        json={"username": "user2", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "user2",
            "password": "password123",
            "device_id": "device-2",
            "device_name": "Device 2",
        },
    )
    token = resp.json()["session_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})

    # Try to access user1's device
    resp = await client.get(f"{DEVICES}/device-1")
    assert resp.status_code == 404


async def test_user_cannot_unregister_other_users_devices(client, db_session):
    """Users cannot unregister other users' devices."""
    from app.models.user import User
    from app.models.device import Device
    from app.utils.security import hash_password

    # Create two users
    user1 = User(
        id="user-1",
        username="user1",
        password_hash=hash_password("password123"),
        role="user",
    )
    user2 = User(
        id="user-2",
        username="user2",
        password_hash=hash_password("password123"),
        role="user",
    )
    db_session.add(user1)
    db_session.add(user2)
    await db_session.commit()

    # Create device for user1
    device = Device(
        id="device-1",
        user_id="user-1",
        device_id="device-uuid-1",
        device_name="User 1 Device",
        config_json={},
    )
    db_session.add(device)
    await db_session.commit()

    # Login as user2
    await client.post(
        "/auth/setup",
        json={"username": "user2", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "user2",
            "password": "password123",
            "device_id": "device-2",
            "device_name": "Device 2",
        },
    )
    token = resp.json()["session_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})

    # Try to unregister user1's device
    resp = await client.delete(f"{DEVICES}/device-1")
    assert resp.status_code == 404


async def test_user_cannot_assign_app_to_other_users_device(client, db_session):
    """Users cannot assign apps to other users' devices."""
    from app.models.user import User
    from app.models.device import Device
    from app.models.app import App
    from app.utils.security import hash_password

    # Create two users
    user1 = User(
        id="user-1",
        username="user1",
        password_hash=hash_password("password123"),
        role="user",
    )
    user2 = User(
        id="user-2",
        username="user2",
        password_hash=hash_password("password123"),
        role="user",
    )
    db_session.add(user1)
    db_session.add(user2)
    await db_session.commit()

    # Create device for user1
    device = Device(
        id="device-1",
        user_id="user-1",
        device_id="device-uuid-1",
        device_name="User 1 Device",
        config_json={},
    )
    db_session.add(device)
    await db_session.commit()

    # Login as user2
    await client.post(
        "/auth/setup",
        json={"username": "user2", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "user2",
            "password": "password123",
            "device_id": "device-2",
            "device_name": "Device 2",
        },
    )
    token = resp.json()["session_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})

    # Create app for user2
    app = App(
        id="app-2",
        user_id="user-2",
        name="User 2 App",
        theme={},
        design_tokens={},
        dark_mode=False,
        bottom_bar_config=[],
        launchpad_config=[],
    )
    db_session.add(app)
    await db_session.commit()

    # Try to assign user2's app to user1's device
    resp = await client.put(
        f"{DEVICES}/device-1/app",
        json={"app_id": "app-2"},
    )
    assert resp.status_code == 404
