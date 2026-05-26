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
from app.models.app_version import AppVersion
from app.models.device import Device
from app.models.preview_session import PreviewSession


def _module_icon_for(
    module_instance_id: str,
    module_icons: dict,
    fallback: str | None = None,
) -> str:
    """Resolve icon from app draft/version overrides, then module metadata."""
    if module_instance_id in module_icons and module_icons[module_instance_id]:
        return str(module_icons[module_instance_id])
    if fallback:
        return fallback
    return "home"


def _config_field(config: dict | None, *keys: str, default=None):
    """Read first present key from a config_json snapshot."""
    if not config:
        return default
    for key in keys:
        if key in config and config[key] is not None:
            return config[key]
    return default


async def _resolve_active_config_json(
    db: AsyncSession,
    device: Device,
    app: App,
) -> dict | None:
    """Pick the config snapshot mobile should render (preview > published > live app)."""
    now = datetime.now(timezone.utc)

    if device.preview_session_id:
        result = await db.execute(
            select(PreviewSession).where(PreviewSession.id == device.preview_session_id)
        )
        session = result.scalar_one_or_none()
        if (
            session is not None
            and session.status == "active"
            and session.expires_at >= now
            and session.resolved_config_json
        ):
            return session.resolved_config_json

    version_id = device.active_app_version_id or app.current_published_version_id
    if version_id:
        result = await db.execute(
            select(AppVersion).where(
                AppVersion.id == version_id,
                AppVersion.app_id == app.id,
            )
        )
        version = result.scalar_one_or_none()
        if version is not None and version.config_json:
            return version.config_json

    return None


def _enrich_bottom_bar(
    bottom_bar_raw: list,
    module_refs: list[AppModuleRef],
    module_icons: dict,
) -> list[dict]:
    """Build mobile bottom_bar_config from snapshot + module instances."""
    enriched: list[dict] = []
    refs_by_id = {ref.module_instance_id: ref for ref in module_refs}

    for index, config_item in enumerate(bottom_bar_raw):
        if not isinstance(config_item, dict):
            continue

        module_instance_id = config_item.get("module_instance_id")
        if not module_instance_id:
            continue

        slot_position = config_item.get("slot_position", index)
        preset_name = config_item.get("name")
        preset_icon = config_item.get("icon")
        preset_type = config_item.get("module_type")

        module_ref = refs_by_id.get(module_instance_id)
        if module_ref and module_ref.module_instance.status == "active":
            instance = module_ref.module_instance
            enriched.append({
                "module_instance_id": module_instance_id,
                "module_type": preset_type or instance.module_type,
                "name": preset_name or instance.name,
                "icon": _module_icon_for(
                    module_instance_id,
                    module_icons,
                    preset_icon,
                ),
                "slot_position": slot_position,
            })
        elif preset_type and preset_name:
            # Draft snapshot may include full slot objects before refs exist
            enriched.append({
                "module_instance_id": module_instance_id,
                "module_type": preset_type,
                "name": preset_name,
                "icon": _module_icon_for(module_instance_id, module_icons, preset_icon),
                "slot_position": slot_position,
            })

    return enriched


def _enrich_launchpad(
    launchpad_raw: list,
    module_refs: list[AppModuleRef],
    module_icons: dict,
) -> list[dict]:
    """Build mobile launchpad_config from snapshot (ids or full module objects)."""
    enriched: list[dict] = []
    refs_by_id = {ref.module_instance_id: ref for ref in module_refs}

    for item in launchpad_raw:
        if isinstance(item, str):
            module_instance_id = item
            preset_name = None
            preset_icon = None
            preset_type = None
        elif isinstance(item, dict):
            module_instance_id = item.get("module_instance_id") or item.get("id")
            preset_name = item.get("name")
            preset_icon = item.get("icon")
            preset_type = item.get("module_type")
        else:
            continue

        if not module_instance_id:
            continue

        module_ref = refs_by_id.get(module_instance_id)
        if module_ref and module_ref.module_instance.status == "active":
            instance = module_ref.module_instance
            enriched.append({
                "module_instance_id": module_instance_id,
                "module_type": preset_type or instance.module_type,
                "name": preset_name or instance.name,
                "icon": _module_icon_for(
                    module_instance_id,
                    module_icons,
                    preset_icon,
                ),
            })
        elif preset_type and preset_name:
            enriched.append({
                "module_instance_id": module_instance_id,
                "module_type": preset_type,
                "name": preset_name,
                "icon": _module_icon_for(module_instance_id, module_icons, preset_icon),
            })

    return enriched


def sync_app_shell_from_config(app: App, config_json: dict) -> None:
    """Mirror published/draft app shell onto the App row for admin APIs."""
    if isinstance(config_json.get("name"), str) and config_json["name"].strip():
        app.name = config_json["name"].strip()
    if "icon" in config_json:
        app.icon = config_json.get("icon")
    if "splash" in config_json:
        app.splash = config_json.get("splash")
    if isinstance(config_json.get("theme"), dict):
        app.theme = config_json["theme"]
    if isinstance(config_json.get("design_tokens"), dict):
        app.design_tokens = config_json["design_tokens"]
    if "dark_mode" in config_json:
        app.dark_mode = bool(config_json["dark_mode"])

    default_launch = _config_field(
        config_json,
        "default_launch_module_instance_id",
        "default_launch_module_id",
    )
    if default_launch is not None:
        app.default_launch_module_id = default_launch

    bottom_bar = config_json.get("bottom_bar_config")
    if isinstance(bottom_bar, list):
        normalized_bb = []
        for index, item in enumerate(bottom_bar):
            if not isinstance(item, dict):
                continue
            module_id = item.get("module_instance_id")
            if not module_id:
                continue
            normalized_bb.append({
                "module_instance_id": module_id,
                "slot_position": item.get("slot_position", index),
            })
        app.bottom_bar_config = normalized_bb

    launchpad = config_json.get("launchpad_config")
    if isinstance(launchpad, list):
        normalized_lp: list[str] = []
        for item in launchpad:
            if isinstance(item, str):
                normalized_lp.append(item)
            elif isinstance(item, dict) and item.get("module_instance_id"):
                normalized_lp.append(str(item["module_instance_id"]))
        app.launchpad_config = normalized_lp


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
        config_json={"device_type": "mobile"},
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

    Serves config from (in order):
    1. Active mobile preview session (temporary App Editor preview)
    2. Device active_app_version_id (published AppVersion snapshot)
    3. App.current_published_version_id
    4. Legacy live App row columns

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
    config_json = await _resolve_active_config_json(db, device, app)

    module_icons = {}
    if config_json:
        raw_icons = config_json.get("module_icons")
        if isinstance(raw_icons, dict):
            module_icons = raw_icons

    bottom_bar_raw = (
        _config_field(config_json, "bottom_bar_config")
        if config_json is not None
        else app.bottom_bar_config
    ) or []

    launchpad_raw = (
        _config_field(config_json, "launchpad_config")
        if config_json is not None
        else app.launchpad_config
    ) or []

    enriched_bottom_bar = _enrich_bottom_bar(
        bottom_bar_raw, list(app.module_refs), module_icons,
    )
    enriched_launchpad = _enrich_launchpad(
        launchpad_raw, list(app.module_refs), module_icons,
    )

    default_launch_module_id = _config_field(
        config_json,
        "default_launch_module_instance_id",
        "default_launch_module_id",
        default=app.default_launch_module_id,
    )

    return {
        "app_id": app.id,
        "name": _config_field(config_json, "name", default=app.name),
        "icon": _config_field(config_json, "icon", default=app.icon),
        "splash": _config_field(config_json, "splash", default=app.splash),
        "theme": _config_field(config_json, "theme", default=app.theme) or {},
        "design_tokens": _config_field(
            config_json, "design_tokens", default=app.design_tokens,
        ) or {},
        "dark_mode": bool(
            _config_field(config_json, "dark_mode", default=app.dark_mode),
        ),
        "default_launch_module_id": default_launch_module_id,
        "bottom_bar_config": enriched_bottom_bar,
        "launchpad_config": enriched_launchpad,
    }


async def list_devices(db: AsyncSession, user_id: str) -> list[Device]:
    """List mobile devices for a user (excludes web admin sessions).

    Args:
        db: Database session
        user_id: Owner user ID

    Returns:
        List of Device instances (mobile only)
    """
    result = await db.execute(
        select(Device)
        .where(Device.user_id == user_id)
        .order_by(Device.created_at)
        .options(selectinload(Device.app))
    )
    all_devices = list(result.scalars().all())
    # Filter out web admin sessions (tagged in auth.upsert_device)
    return [
        d for d in all_devices
        if d.config_json.get("device_type") != "web_admin"
    ]


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
