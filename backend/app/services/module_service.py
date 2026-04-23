"""Module service — helpers for ModuleInstance lifecycle.

resolve_legacy_instance_id is the key helper used by MCP tools: when a tool
call arrives without an explicit module_instance_id (i.e. a direct agent call
that predates the mini-app platform), we look up or create the user's synthetic
"legacy" instance so that writes still land somewhere coherent.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
