"""Validation service — unified validation for apps, modules, and previews.

Essential validators only. Full validation pipeline is Phase 5.13 (out of scope).
"""

from typing import Any

from app.models.device import Device


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

    # Validate bottom bar
    bottom_bar = app_config.get("bottom_bar_config", [])
    if len(bottom_bar) > 5:
        errors.append("Bottom bar can have at most 5 items")

    # Validate launchpad (if provided as list)
    launchpad = app_config.get("launchpad_config", [])
    if not isinstance(launchpad, list):
        errors.append("launchpad_config must be a list")

    # Validate default_launch_module exists if specified
    default_launch = app_config.get("default_launch_module_id")
    if default_launch:
        bb_ids = {item.get("module_instance_id") for item in bottom_bar if isinstance(item, dict)}
        lp_ids = set(launchpad)
        if default_launch not in bb_ids and default_launch not in lp_ids:
            errors.append(
                f"default_launch_module_id '{default_launch}' not found in bottom_bar or launchpad"
            )

    return len(errors) == 0, errors


def validate_publish_config(
    app_config: dict,
    device_ids: list[str] | None = None,
    devices: list[Device] | None = None,
) -> tuple[bool, list[str]]:
    """Validate configuration before publishing to devices.

    Extends validate_app_config with device compatibility checks:
    - required app fields (name, content)
    - device runtime version compatibility
    - device schema version compatibility

    Args:
        app_config: The app configuration dict to validate.
        device_ids: DEPRECATED — list of device IDs (kept for backward compatibility).
        devices: List of Device ORM objects assigned to this app.

    Returns:
        Tuple of (is_valid, list of error messages)
    """
    is_valid, errors = validate_app_config(app_config)

    # Check that app has a name
    if not app_config.get("name"):
        errors.append("App must have a name")

    # Check that at least bottom_bar or launchpad has content
    bottom_bar = app_config.get("bottom_bar_config", [])
    launchpad = app_config.get("launchpad_config", [])
    if not bottom_bar and not launchpad:
        errors.append("App must have at least one module (in bottom_bar or launchpad)")

    # Validate device compatibility if devices are provided
    if devices:
        for device in devices:
            device_errors = _validate_device_compatibility(device)
            errors.extend(device_errors)

    return len(errors) == 0, errors


def _validate_device_compatibility(device: Device) -> list[str]:
    """Validate a single device's compatibility for receiving a published version.

    Checks:
    - installed_runtime_version is set and meets minimum requirements
    - supported_schema_versions can handle current schema

    Returns a list of error messages (empty if device is compatible).
    """
    errors: list[str] = []
    device_label = device.device_name or device.id

    # Check runtime version is known
    if not device.installed_runtime_version:
        errors.append(
            f"Device '{device_label}' has no installed runtime version — "
            "ensure device has reported its runtime version"
        )
        return errors  # Can't check further without runtime version

    # Check schema version support
    if not device.supported_schema_versions:
        errors.append(
            f"Device '{device_label}' has no supported schema versions — "
            "ensure device has reported its schema capabilities"
        )

    return errors


def validate_preview_config(config: dict) -> tuple[bool, list[str]]:
    """Lightweight validation for preview configs.

    Only checks essential structure — less strict than publish validation.
    """
    errors: list[str] = []

    bottom_bar = config.get("bottom_bar_config", [])
    if len(bottom_bar) > 5:
        errors.append("Bottom bar can have at most 5 items")

    return len(errors) == 0, errors
