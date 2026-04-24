"""App service — business logic for App CRUD and configuration management.

Handles:
- App creation, retrieval, update, deletion
- Bottom bar config validation (5-slot cap)
- Bottom bar config enrichment (join with ModuleInstance for metadata)
- Launchpad management
- Device assignment
"""

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.app import App
from app.models.app_module_ref import AppModuleRef
from app.models.device import Device
from app.models.module_instance import ModuleInstance


async def create_app(
    db: AsyncSession,
    user_id: str,
    name: str,
    icon: str | None = None,
    splash: str | None = None,
    theme: dict | None = None,
    design_tokens: dict | None = None,
    dark_mode: bool = False,
    default_launch_module_id: str | None = None,
    bottom_bar_config: list | None = None,
    launchpad_config: list | None = None,
) -> App:
    """Create a new app for the user.

    Args:
        db: Database session
        user_id: Owner user ID
        name: App display name
        icon: Optional icon URL
        splash: Optional splash screen image
        theme: Optional theme config dict
        design_tokens: Optional design tokens dict
        dark_mode: Dark mode enabled flag
        default_launch_module_id: Optional default module to launch
        bottom_bar_config: Optional bottom bar config (max 5 items)
        launchpad_config: Optional launchpad config

    Returns:
        Created App instance
    """
    app = App(
        id=str(uuid4()),
        user_id=user_id,
        name=name,
        icon=icon,
        splash=splash,
        theme=theme or {},
        design_tokens=design_tokens or {},
        dark_mode=dark_mode,
        default_launch_module_id=default_launch_module_id,
        bottom_bar_config=bottom_bar_config or [],
        launchpad_config=launchpad_config or [],
    )
    db.add(app)
    await db.flush()
    return app


async def get_app(db: AsyncSession, app_id: str, user_id: str) -> App | None:
    """Get app by ID with enriched bottom bar config.

    Enriches bottom_bar_config by joining AppModuleRef with ModuleInstance
    to include module_type, name, icon metadata. This allows mobile to map
    module_instance_id to routes without additional fetches.

    Args:
        db: Database session
        app_id: App ID
        user_id: Owner user ID (for authorization)

    Returns:
        App instance with enriched bottom_bar_config, or None if not found
    """
    result = await db.execute(
        select(App)
        .where(App.id == app_id, App.user_id == user_id)
        .options(selectinload(App.module_refs).selectinload(AppModuleRef.module_instance))
    )
    app = result.scalar_one_or_none()

    if app is None:
        return None

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

    # Replace bottom_bar_config with enriched version
    app.bottom_bar_config = enriched_bottom_bar

    return app


async def update_app(
    db: AsyncSession,
    app_id: str,
    user_id: str,
    **updates,
) -> App | None:
    """Update app fields.

    Args:
        db: Database session
        app_id: App ID
        user_id: Owner user ID (for authorization)
        **updates: Fields to update

    Returns:
        Updated App instance, or None if not found
    """
    result = await db.execute(
        select(App).where(App.id == app_id, App.user_id == user_id)
    )
    app = result.scalar_one_or_none()

    if app is None:
        return None

    for key, value in updates.items():
        if hasattr(app, key):
            setattr(app, key, value)

    await db.flush()
    return app


async def delete_app(db: AsyncSession, app_id: str, user_id: str) -> bool:
    """Delete app and cascade to AppModuleRef rows.

    Args:
        db: Database session
        app_id: App ID
        user_id: Owner user ID (for authorization)

    Returns:
        True if deleted, False if not found
    """
    result = await db.execute(
        select(App).where(App.id == app_id, App.user_id == user_id)
    )
    app = result.scalar_one_or_none()

    if app is None:
        return False

    await db.delete(app)
    await db.flush()
    return True


async def list_apps(db: AsyncSession, user_id: str) -> list[App]:
    """List all apps for a user.

    Args:
        db: Database session
        user_id: Owner user ID

    Returns:
        List of App instances
    """
    result = await db.execute(
        select(App).where(App.user_id == user_id).order_by(App.created_at)
    )
    return list(result.scalars().all())


async def validate_bottom_bar_config(
    db: AsyncSession,
    user_id: str,
    bottom_bar_config: list,
) -> tuple[bool, str | None]:
    """Validate bottom bar configuration.

    Rules:
    - Max 5 items
    - All module_instance_ids must exist and belong to user
    - slot_position must be 0-4

    Args:
        db: Database session
        user_id: Owner user ID
        bottom_bar_config: Bottom bar config to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(bottom_bar_config) > 5:
        return False, "Bottom bar can have at most 5 items"

    for item in bottom_bar_config:
        module_instance_id = item.get("module_instance_id")
        slot_position = item.get("slot_position")

        if not module_instance_id:
            return False, "Missing module_instance_id in bottom bar config"

        if slot_position is None or not (0 <= slot_position <= 4):
            return False, "slot_position must be 0-4"

        # Verify module instance exists and belongs to user
        result = await db.execute(
            select(ModuleInstance).where(
                ModuleInstance.id == module_instance_id,
                ModuleInstance.user_id == user_id,
            )
        )
        module_instance = result.scalar_one_or_none()

        if module_instance is None:
            return False, f"Module instance {module_instance_id} not found"

        if module_instance.status != "active":
            return False, f"Module instance {module_instance_id} is not active"

    return True, None


async def assign_app_to_device(
    db: AsyncSession,
    device_id: str,
    app_id: str,
    user_id: str,
) -> Device | None:
    """Assign an app to a device.

    Args:
        db: Database session
        device_id: Device ID
        app_id: App ID to assign
        user_id: Owner user ID (for authorization)

    Returns:
        Updated Device instance, or None if device/app not found
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
