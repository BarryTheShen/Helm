"""Validation service — unified validation for apps, modules, and previews.

Supports multi-stage validation (FF4-VER-006): autosave, checkpoint, preview, publish.
Publish errors include Module → Row → Cell → Component paths (FF4-VER-007).
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.models.module_instance import ModuleInstance
from app.models.module_version import ModuleVersion
from app.mcp.tools import _VALID_V2_COMPONENT_TYPES, _normalize_sdui_type
from app.services.sdui_state import validate_sdui_screen_payload


def validate_app_config(app_config: dict) -> tuple[bool, list[str]]:
    """Validate an app configuration.

    Checks:
    - bottom_bar has at most 5 slots
    - launchpad contains valid module references
    - default_launch_module exists in bottom_bar or launchpad

    Returns:
        Tuple of (is_valid, list of error messages)
    """
    errors: list[str] = []

    bottom_bar = app_config.get("bottom_bar_config", [])
    if len(bottom_bar) > 5:
        errors.append("Bottom bar can have at most 5 items")

    launchpad = app_config.get("launchpad_config", [])
    if not isinstance(launchpad, list):
        errors.append("launchpad_config must be a list")

    default_launch = app_config.get("default_launch_module_id")
    if default_launch:
        bb_ids = {item.get("module_instance_id") for item in bottom_bar if isinstance(item, dict)}
        lp_ids = set(launchpad)
        if default_launch not in bb_ids and default_launch not in lp_ids:
            errors.append(
                f"default_launch_module_id '{default_launch}' not found in bottom_bar or launchpad"
            )

    return len(errors) == 0, errors


def validate_autosave_config(config: dict) -> tuple[bool, list[str]]:
    """Lightweight autosave validation (FF4-VER-006).

    Ensures JSON shape is not catastrophically invalid while allowing incomplete drafts.
    """
    errors: list[str] = []

    if not isinstance(config, dict):
        return False, ["Config must be a JSON object"]

    bottom_bar = config.get("bottom_bar_config")
    if bottom_bar is not None and not isinstance(bottom_bar, list):
        errors.append("bottom_bar_config must be a list")

    launchpad = config.get("launchpad_config")
    if launchpad is not None and not isinstance(launchpad, list):
        errors.append("launchpad_config must be a list")

    theme = config.get("theme")
    if theme is not None and not isinstance(theme, dict):
        errors.append("theme must be an object")

    design_tokens = config.get("design_tokens")
    if design_tokens is not None and not isinstance(design_tokens, dict):
        errors.append("design_tokens must be an object")

    return len(errors) == 0, errors


def validate_checkpoint_sdui(sdui_json: dict) -> tuple[bool, list[str]]:
    """Full SDUI validation for checkpoint/version creation (FF4-VER-006)."""
    _, errors = validate_sdui_screen_payload(sdui_json)
    return len(errors) == 0, errors


def validate_publish_config(
    app_config: dict,
    device_ids: list[str] | None = None,
    devices: list[Device] | None = None,
) -> tuple[bool, list[str]]:
    """Validate app configuration before publishing to devices.

    Extends validate_app_config with device compatibility checks.
    Module SDUI validation is handled by validate_publish_modules().
    """
    is_valid, errors = validate_app_config(app_config)

    if not app_config.get("name"):
        errors.append("App must have a name")

    bottom_bar = app_config.get("bottom_bar_config", [])
    launchpad = app_config.get("launchpad_config", [])
    if not bottom_bar and not launchpad:
        errors.append("App must have at least one module (in bottom_bar or launchpad)")

    if devices:
        for device in devices:
            errors.extend(_validate_device_compatibility(device))

    return len(errors) == 0, errors


def format_publish_location_error(
    module_name: str,
    row_num: int,
    cell_num: int,
    issue: str,
    version_label: str,
    fix_guidance: str,
) -> str:
    """Format a publish validation error with Module → Row → Cell path (FF4-VER-007)."""
    location = f"{module_name} → Row {row_num} → Cell {cell_num}"
    return (
        f"{location}: {issue}. "
        f"This component is used by {module_name} version '{version_label}'. "
        f"Fix: {fix_guidance}."
    )


def collect_module_publish_errors(
    module_name: str,
    version_label: str,
    sdui_json: dict[str, Any] | None,
) -> list[str]:
    """Validate module SDUI for publish and return location-aware error strings."""
    if not isinstance(sdui_json, dict):
        return [
            f"{module_name}: module version '{version_label}' has no valid SDUI content. "
            "Fix: create a checkpoint with a valid row/cell layout."
        ]

    errors: list[str] = []
    rows = sdui_json.get("rows")
    if not isinstance(rows, list):
        return errors

    for row_idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        cells = row.get("cells")
        if not isinstance(cells, list):
            continue
        for cell_idx, cell in enumerate(cells, start=1):
            if not isinstance(cell, dict):
                continue
            content = cell.get("content")
            if not isinstance(content, dict):
                continue
            comp_type = content.get("type", "")
            if not comp_type:
                errors.append(
                    format_publish_location_error(
                        module_name,
                        row_idx,
                        cell_idx,
                        "Component is missing required 'type' field",
                        version_label,
                        "Add a valid component type such as Text or Button",
                    )
                )
                continue

            normalized = _normalize_sdui_type(comp_type)
            if normalized not in _VALID_V2_COMPONENT_TYPES:
                errors.append(
                    format_publish_location_error(
                        module_name,
                        row_idx,
                        cell_idx,
                        f"Unknown component type '{comp_type}'",
                        version_label,
                        f"register {comp_type} as a real component, or replace it with a supported component",
                    )
                )

    return errors


async def validate_publish_modules(
    db: AsyncSession,
    user_id: str,
    resolved: list[dict[str, Any]],
) -> list[str]:
    """Validate resolved module versions referenced by an app publish (FF4-VER-006/007)."""
    errors: list[str] = []

    for entry in resolved:
        module_id = entry.get("module_id")
        version_id = entry.get("version_id")
        status = entry.get("status")

        if status == "module_not_found":
            errors.append(
                f"Module '{module_id}' referenced in app config was not found. "
                "Fix: restore the module or remove it from the bottom bar and launchpad."
            )
            continue

        if not version_id:
            result = await db.execute(
                select(ModuleInstance.name).where(
                    ModuleInstance.id == module_id,
                    ModuleInstance.user_id == user_id,
                )
            )
            module_name = result.scalar_one_or_none() or module_id
            errors.append(
                f"{module_name}: no published module version is available. "
                "Fix: create a module checkpoint before publishing the app."
            )
            continue

        result = await db.execute(
            select(ModuleInstance, ModuleVersion)
            .join(ModuleVersion, ModuleVersion.id == version_id)
            .where(
                ModuleInstance.id == module_id,
                ModuleInstance.user_id == user_id,
                ModuleVersion.module_id == module_id,
            )
        )
        row = result.first()
        if row is None:
            errors.append(
                f"Module '{module_id}' version '{version_id}' could not be loaded. "
                "Fix: restore the module version or select a valid checkpoint."
            )
            continue

        instance, version = row
        module_name = instance.name or module_id
        version_label = (
            version.custom_name
            or version.display_name
            or version.default_timestamp_name
            or str(version.version_number)
        )
        errors.extend(
            collect_module_publish_errors(module_name, version_label, version.sdui_json)
        )

        if instance.status == "disabled":
            errors.append(
                f"{module_name} is disabled but still referenced by the app. "
                "Fix: re-enable the module or remove it from the bottom bar and launchpad."
            )

    return errors


async def validate_publish_full(
    db: AsyncSession,
    app_config: dict,
    user_id: str,
    resolved: list[dict[str, Any]],
    devices: list[Device] | None = None,
) -> tuple[bool, list[str]]:
    """Run all publish-stage validations (FF4-VER-006)."""
    errors: list[str] = []

    _, app_errors = validate_publish_config(app_config, devices=devices)
    errors.extend(app_errors)

    module_errors = await validate_publish_modules(db, user_id, resolved)
    errors.extend(module_errors)

    return len(errors) == 0, errors


def _validate_device_compatibility(device: Device) -> list[str]:
    """Validate a single device's compatibility for receiving a published version."""
    errors: list[str] = []
    device_label = device.device_name or device.id

    if not device.installed_runtime_version:
        errors.append(
            f"Device '{device_label}' has no installed runtime version — "
            "ensure device has reported its runtime version"
        )
        return errors

    if not device.supported_schema_versions:
        errors.append(
            f"Device '{device_label}' has no supported schema versions — "
            "ensure device has reported its schema capabilities"
        )

    return errors


def validate_preview_config(config: dict) -> tuple[bool, list[str]]:
    """Lightweight validation for preview configs."""
    errors: list[str] = []

    bottom_bar = config.get("bottom_bar_config", [])
    if len(bottom_bar) > 5:
        errors.append("Bottom bar can have at most 5 items")

    return len(errors) == 0, errors
