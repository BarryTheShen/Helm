"""Device service — business logic for device registration and management.

Handles:
- Device registration (self-service)
- App assignment to devices
- Device app config retrieval (full config for mobile)
- Device listing
- Connection state tracking
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.app import App
from app.models.app_module_ref import AppModuleRef
from app.models.device import Device
from app.models.module_instance import ModuleInstance


async def register_device(
    db: AsyncSession,
    user_id: str,
    device_name: str,
    device_id: str,
) -> Device:
    """Register a new device or update existing device's last_seen.

    If device_id already exists, updates last_seen instead of creating new row.

    Args:
        db: Database session
        user_id: Owner user ID
        device_name: Human-readable device name
        device_id: Unique device identifier (UUID from mobile)

    Returns:
        Device instance (new or existing)
    """
    # Check if device already exists
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()

    if device is not None:
        # Update last_seen for existing device
        device.last_seen = datetime.now(timezone.utc)
        await db.flush()
        return device

    # Create new device
    device = Device(
        id=str(uuid4()),
        user_id=user_id,
        device_id=device_id,
        device_name=device_name,
        config_json={},
        last_seen=datetime.now(timezone.utc),
        assigned_app_id=None,
    )
    db.add(device)
    await db.flush()
    return device


async def assign_app_to_device(
    db: AsyncSession,
    device_id: str,
    app_id: str,
    user_id: str,
) -> Device | None:
    """Assign an app to a device.

    Args:
        db: Database session
        device_id: Device ID (UUID primary key, not device_id field)
        app_id: App ID to assign
        user_id: Owner user ID (for authorization)

    Returns:
        Updated Device instance, or None if device/app not found or unauthorized
    """
    # Verify device belongs to user
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()

    if device is None:
        return None

    # Verify app belongs to user
    result = await db.execute(
        select(App).where(App.id == app_id, App.user_id == user_id)
    )
    app = result.scalar_one_or_none()

    if app is None:
        return None

    device.assigned_app_id = app_id
    await db.flush()
    return device


async def get_device_app_config(db: AsyncSession, device_id: str) -> dict | None:
    """Get full app configuration for a device (for mobile consumption).

    Returns enriched app config with:
    - App metadata (name, icon, theme, etc.)
    - Enriched bottom_bar_config (with module_type, name, icon)
    - Enriched launchpad_config (with module metadata)

    Args:
        db: Database session
        device_id: Device ID (UUID primary key)

    Returns:
        Dict with full app config, or None if device has no assigned app
    """
    # Get device with assigned app
    result = await db.execute(
        select(Device)
        .where(Device.id == device_id)
        .options(
            selectinload(Device.app)
            .selectinload(App.module_refs)
            .selectinload(AppModuleRef.module_instance)
        )
    )
    device = result.scalar_one_or_none()

    if device is None or device.assigned_app_id is None:
        return None

    app = device.app

    # Enrich bottom_bar_config with module metadata
    enriched_bottom_bar = []
    for config_item in app.bottom_bar_config:
        module_instance_id = config_item.get("module_instance_id")
        slot_position = config_item.get("slot_position")

        # Find the corresponding module_instance via AppModuleRef
        module_ref = next(
            (ref for ref in app.module_refs if ref.module_instance_id == module_instance_id),
            None
        )

        if module_ref and module_ref.module_instance.status == "active":
            enriched_bottom_bar.append({
                "module_instance_id": module_instance_id,
                "module_type": module_ref.module_instance.module_type,
                "name": module_ref.module_instance.name,
                "icon": "home",  # TODO: Add icon field to ModuleInstance model
                "slot_position": slot_position,
            })

    # Enrich launchpad_config with module metadata
    enriched_launchpad = []
    for module_instance_id in app.launchpad_config:
        # Find the corresponding module_instance via AppModuleRef
        module_ref = next(
            (ref for ref in app.module_refs if ref.module_instance_id == module_instance_id),
            None
        )

        if module_ref and module_ref.module_instance.status == "active":
            enriched_launchpad.append({
                "module_instance_id": module_instance_id,
                "module_type": module_ref.module_instance.module_type,
                "name": module_ref.module_instance.name,
                "icon": "home",  # TODO: Add icon field to ModuleInstance model
            })

    return {
        "app_id": app.id,
        "name": app.name,
        "icon": app.icon,
        "splash": app.splash,
        "theme": app.theme,
        "design_tokens": app.design_tokens,
        "dark_mode": app.dark_mode,
        "default_launch_module_id": app.default_launch_module_id,
        "bottom_bar_config": enriched_bottom_bar,
        "launchpad_config": enriched_launchpad,
    }


async def list_devices(db: AsyncSession, user_id: str) -> list[Device]:
    """List all devices for a user.

    Args:
        db: Database session
        user_id: Owner user ID

    Returns:
        List of Device instances
    """
    result = await db.execute(
        select(Device)
        .where(Device.user_id == user_id)
        .order_by(Device.created_at)
        .options(selectinload(Device.app))
    )
    return list(result.scalars().all())


async def update_connection_state(
    db: AsyncSession,
    device_id: str,
) -> Device | None:
    """Update device's last_seen timestamp (called on WebSocket messages).

    Args:
        db: Database session
        device_id: Device ID (UUID primary key)

    Returns:
        Updated Device instance, or None if not found
    """
    result = await db.execute(
        select(Device).where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()

    if device is None:
        return None

    device.last_seen = datetime.now(timezone.utc)
    await db.flush()
    return device


async def unregister_device(
    db: AsyncSession,
    device_id: str,
    user_id: str,
) -> bool:
    """Unregister (delete) a device.

    Args:
        db: Database session
        device_id: Device ID (UUID primary key)
        user_id: Owner user ID (for authorization)

    Returns:
        True if deleted, False if not found
    """
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == user_id)
    )
    device = result.scalar_one_or_none()

    if device is None:
        return False

    await db.delete(device)
    await db.flush()
    return True
