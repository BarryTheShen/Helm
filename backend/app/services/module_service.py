"""Module service — helpers for ModuleInstance lifecycle.

resolve_legacy_instance_id is the key helper used by MCP tools: when a tool
call arrives without an explicit module_instance_id (i.e. a direct agent call
that predates the mini-app platform), we look up or create the user's synthetic
"legacy" instance so that writes still land somewhere coherent.

Extended in Phase 1 with app-aware operations:
- get_module_usage: which apps reference this module
- enable_module: enable module in an app
- disable_module: disable module in an app
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import App
from app.models.app_module_ref import AppModuleRef
from app.models.module_instance import ModuleInstance

_LEGACY_MODULE_TYPE = "legacy"
_LEGACY_MODULE_NAME = "Legacy"


async def resolve_legacy_instance_id(user_id: str, db: AsyncSession) -> str:
    """Return the id of the user's synthetic 'legacy' ModuleInstance.

    Creates the instance on first call (idempotent via the unique constraint on
    (user_id, module_type)).  This is used by MCP tools when no explicit
    module_instance_id is provided so that writes are always scoped to an instance.
    """
    result = await db.execute(
        select(ModuleInstance).where(
            ModuleInstance.user_id == user_id,
            ModuleInstance.module_type == _LEGACY_MODULE_TYPE,
        )
    )
    instance = result.scalars().first()
    if instance is not None:
        return instance.id

    instance = ModuleInstance(
        id=str(uuid.uuid4()),
        user_id=user_id,
        module_type=_LEGACY_MODULE_TYPE,
        name=_LEGACY_MODULE_NAME,
        version="0.0.0",
        status="active",
    )
    db.add(instance)
    await db.flush()  # get the id without committing the outer transaction
    return instance.id


async def get_module_usage(
    db: AsyncSession,
    module_instance_id: str,
) -> list[App]:
    """Get list of apps that reference this module instance.

    Used by UI to show "affected apps" before rename/delete operations.

    Args:
        db: Database session
        module_instance_id: ModuleInstance ID

    Returns:
        List of App instances that reference this module
    """
    result = await db.execute(
        select(App)
        .join(AppModuleRef, AppModuleRef.app_id == App.id)
        .where(AppModuleRef.module_instance_id == module_instance_id)
        .order_by(App.name)
    )
    return list(result.scalars().all())


async def enable_module(
    db: AsyncSession,
    app_id: str,
    module_instance_id: str,
) -> bool:
    """Enable a module instance in an app (set status to 'active').

    Args:
        db: Database session
        app_id: App ID (for context, not used in current implementation)
        module_instance_id: ModuleInstance ID

    Returns:
        True if enabled, False if not found
    """
    result = await db.execute(
        select(ModuleInstance).where(ModuleInstance.id == module_instance_id)
    )
    module_instance = result.scalar_one_or_none()

    if module_instance is None:
        return False

    module_instance.status = "active"
    await db.flush()
    return True


async def disable_module(
    db: AsyncSession,
    app_id: str,
    module_instance_id: str,
) -> bool:
    """Disable a module instance in an app (set status to 'disabled').

    Args:
        db: Database session
        app_id: App ID (for context, not used in current implementation)
        module_instance_id: ModuleInstance ID

    Returns:
        True if disabled, False if not found
    """
    result = await db.execute(
        select(ModuleInstance).where(ModuleInstance.id == module_instance_id)
    )
    module_instance = result.scalar_one_or_none()

    if module_instance is None:
        return False

    module_instance.status = "disabled"
    await db.flush()
    return True
