"""Tests for app CRUD endpoints."""

import pytest


pytestmark = pytest.mark.anyio

APPS = "/api/apps"


async def test_list_apps_empty(auth_client):
    """List apps when none exist."""
    resp = await auth_client.get(APPS)
    assert resp.status_code == 200
    data = resp.json()
    assert data == []


async def test_apps_requires_auth(client):
    """Apps endpoints require authentication."""
    resp = await client.get(APPS)
    assert resp.status_code == 401


async def test_create_app_minimal(auth_client):
    """Create app with minimal required fields."""
    resp = await auth_client.post(
        APPS,
        json={"name": "My App"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My App"
    assert data["theme"] == {}
    assert data["design_tokens"] == {}
    assert data["dark_mode"] is False
    assert data["bottom_bar_config"] == []
    assert data["launchpad_config"] == []
    assert "id" in data
    assert "user_id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_app_full(auth_client):
    """Create app with all fields."""
    resp = await auth_client.post(
        APPS,
        json={
            "name": "Full App",
            "icon": "https://example.com/icon.png",
            "splash": "https://example.com/splash.png",
            "theme": {"primary": "#007AFF"},
            "design_tokens": {"spacing": 16},
            "dark_mode": True,
            "default_launch_module_id": "module-123",
            "bottom_bar_config": [],
            "launchpad_config": [],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Full App"
    assert data["icon"] == "https://example.com/icon.png"
    assert data["splash"] == "https://example.com/splash.png"
    assert data["theme"] == {"primary": "#007AFF"}
    assert data["design_tokens"] == {"spacing": 16}
    assert data["dark_mode"] is True
    assert data["default_launch_module_id"] == "module-123"


async def test_list_apps_after_create(auth_client):
    """List apps returns created apps."""
    await auth_client.post(APPS, json={"name": "App 1"})
    await auth_client.post(APPS, json={"name": "App 2"})

    resp = await auth_client.get(APPS)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["name"] == "App 1"
    assert data[1]["name"] == "App 2"


async def test_get_app_by_id(auth_client):
    """Get app by ID."""
    create_resp = await auth_client.post(APPS, json={"name": "Test App"})
    app_id = create_resp.json()["id"]

    resp = await auth_client.get(f"{APPS}/{app_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == app_id
    assert data["name"] == "Test App"


async def test_get_app_not_found(auth_client):
    """Get app returns 404 for non-existent ID."""
    resp = await auth_client.get(f"{APPS}/nonexistent-id")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "App not found"


async def test_update_app(auth_client):
    """Update app fields."""
    create_resp = await auth_client.post(APPS, json={"name": "Old Name"})
    app_id = create_resp.json()["id"]

    resp = await auth_client.put(
        f"{APPS}/{app_id}",
        json={
            "name": "New Name",
            "icon": "https://example.com/new-icon.png",
            "dark_mode": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["icon"] == "https://example.com/new-icon.png"
    assert data["dark_mode"] is True


async def test_update_app_partial(auth_client):
    """Update app with partial fields."""
    create_resp = await auth_client.post(
        APPS,
        json={"name": "Original", "icon": "icon.png", "dark_mode": False},
    )
    app_id = create_resp.json()["id"]

    # Update only name
    resp = await auth_client.put(f"{APPS}/{app_id}", json={"name": "Updated"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated"
    assert data["icon"] == "icon.png"  # Unchanged
    assert data["dark_mode"] is False  # Unchanged


async def test_update_app_not_found(auth_client):
    """Update app returns 404 for non-existent ID."""
    resp = await auth_client.put(
        f"{APPS}/nonexistent-id",
        json={"name": "Ghost"},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "App not found"


async def test_delete_app(auth_client):
    """Delete app."""
    create_resp = await auth_client.post(APPS, json={"name": "To Delete"})
    app_id = create_resp.json()["id"]

    resp = await auth_client.delete(f"{APPS}/{app_id}")
    assert resp.status_code == 204

    # Verify app is deleted
    list_resp = await auth_client.get(APPS)
    ids = [app["id"] for app in list_resp.json()]
    assert app_id not in ids


async def test_delete_app_not_found(auth_client):
    """Delete app returns 404 for non-existent ID."""
    resp = await auth_client.delete(f"{APPS}/nonexistent-id")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "App not found"


# ── Bottom Bar Config Tests ────────────────────────────────────────────────


async def test_create_app_with_bottom_bar_config(auth_client, db_session):
    """Create app with valid bottom bar config."""
    # Create a module instance first
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="module-1",
        user_id=user.id,
        module_type="chat",
        name="Chat Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    resp = await auth_client.post(
        APPS,
        json={
            "name": "App with Bottom Bar",
            "bottom_bar_config": [
                {"module_instance_id": "module-1", "slot_position": 0}
            ],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["bottom_bar_config"]) == 1
    assert data["bottom_bar_config"][0]["module_instance_id"] == "module-1"


async def test_create_app_bottom_bar_max_5_slots(auth_client, db_session):
    """Bottom bar config enforces 5-slot cap."""
    # Create 6 module instances with different module types
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module_types = ["chat", "calendar", "todo", "notes", "weather", "news"]
    for i in range(6):
        module = ModuleInstance(
            id=f"module-{i}",
            user_id=user.id,
            module_type=module_types[i],
            name=f"Module {i}",
            status="active",
        )
        db_session.add(module)
    await db_session.commit()

    # Try to create app with 6 slots
    resp = await auth_client.post(
        APPS,
        json={
            "name": "Too Many Slots",
            "bottom_bar_config": [
                {"module_instance_id": f"module-{i}", "slot_position": i}
                for i in range(6)
            ],
        },
    )
    assert resp.status_code == 400
    assert "at most 5 items" in resp.json()["detail"]


async def test_create_app_bottom_bar_invalid_module(auth_client):
    """Bottom bar config validates module_instance_id exists."""
    resp = await auth_client.post(
        APPS,
        json={
            "name": "Invalid Module",
            "bottom_bar_config": [
                {"module_instance_id": "nonexistent", "slot_position": 0}
            ],
        },
    )
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"]


async def test_create_app_bottom_bar_inactive_module(auth_client, db_session):
    """Bottom bar config rejects inactive modules."""
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="inactive-module",
        user_id=user.id,
        module_type="chat",
        name="Inactive Module",
        status="inactive",
    )
    db_session.add(module)
    await db_session.commit()

    resp = await auth_client.post(
        APPS,
        json={
            "name": "Inactive Module App",
            "bottom_bar_config": [
                {"module_instance_id": "inactive-module", "slot_position": 0}
            ],
        },
    )
    assert resp.status_code == 400
    assert "not active" in resp.json()["detail"]


async def test_create_app_bottom_bar_invalid_slot_position(auth_client, db_session):
    """Bottom bar config validates slot_position is 0-4."""
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="module-1",
        user_id=user.id,
        module_type="chat",
        name="Chat Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    resp = await auth_client.post(
        APPS,
        json={
            "name": "Invalid Slot",
            "bottom_bar_config": [
                {"module_instance_id": "module-1", "slot_position": 5}
            ],
        },
    )
    assert resp.status_code == 400
    assert "slot_position must be 0-4" in resp.json()["detail"]


async def test_update_bottom_bar_endpoint(auth_client, db_session):
    """Update bottom bar config via dedicated endpoint."""
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="module-1",
        user_id=user.id,
        module_type="chat",
        name="Chat Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    # Create app
    create_resp = await auth_client.post(APPS, json={"name": "Test App"})
    app_id = create_resp.json()["id"]

    # Update bottom bar
    resp = await auth_client.put(
        f"{APPS}/{app_id}/bottom-bar",
        json={
            "bottom_bar_config": [
                {"module_instance_id": "module-1", "slot_position": 0}
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["bottom_bar_config"]) == 1


async def test_get_app_enriched_bottom_bar(auth_client, db_session):
    """Get app returns enriched bottom bar config with module metadata."""
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
    create_resp = await auth_client.post(
        APPS,
        json={
            "name": "Test App",
            "bottom_bar_config": [
                {"module_instance_id": "module-1", "slot_position": 0}
            ],
        },
    )
    app_id = create_resp.json()["id"]

    # Create AppModuleRef
    ref = AppModuleRef(
        id="ref-1",
        app_id=app_id,
        module_instance_id="module-1",
    )
    db_session.add(ref)
    await db_session.commit()

    # Get app - should return enriched bottom bar
    resp = await auth_client.get(f"{APPS}/{app_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["bottom_bar_config"]) == 1
    config_item = data["bottom_bar_config"][0]
    assert config_item["module_instance_id"] == "module-1"
    assert config_item["module_type"] == "chat"
    assert config_item["name"] == "Chat Module"
    assert config_item["slot_position"] == 0
    assert "icon" in config_item


# ── Authorization Tests ────────────────────────────────────────────────────


async def test_user_cannot_access_other_users_apps(client, db_session):
    """Users can only access their own apps."""
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

    # Try to access user1's app
    resp = await client.get(f"{APPS}/app-1")
    assert resp.status_code == 404


async def test_user_cannot_update_other_users_apps(client, db_session):
    """Users cannot update other users' apps."""
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

    # Try to update user1's app
    resp = await client.put(f"{APPS}/app-1", json={"name": "Hacked"})
    assert resp.status_code == 404


async def test_user_cannot_delete_other_users_apps(client, db_session):
    """Users cannot delete other users' apps."""
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

    # Try to delete user1's app
    resp = await client.delete(f"{APPS}/app-1")
    assert resp.status_code == 404
