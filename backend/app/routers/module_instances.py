"""ModuleInstance router — CRUD + install/uninstall (Phase 4a/4c)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models.module_instance import ModuleInstance
from app.models.template import SDUITemplate
from app.schemas.module_instance import ModuleInstallRequest, ModuleInstanceOut
from app.services.audit import log_audit
from app.services.websocket_manager import manager as ws_manager

router = APIRouter(prefix="/api/modules", tags=["module-instances"])


# ---------------------------------------------------------------------------
# Read endpoints (Phase 4a)
# ---------------------------------------------------------------------------

@router.get("/instances", response_model=list[ModuleInstanceOut])
async def list_module_instances(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ModuleInstanceOut]:
    """List all ModuleInstances for the authenticated user."""
    result = await db.execute(
        select(ModuleInstance)
        .where(ModuleInstance.user_id == user_id)
        .order_by(ModuleInstance.created_at.desc())
    )
    instances = result.scalars().all()
    return [ModuleInstanceOut.from_orm_alias(i) for i in instances]


@router.get("/instances/{instance_id}", response_model=ModuleInstanceOut)
async def get_module_instance(
    instance_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ModuleInstanceOut:
    """Fetch a single ModuleInstance. Returns 404 if not found or not owned by caller."""
    result = await db.execute(
        select(ModuleInstance).where(
            ModuleInstance.id == instance_id,
            ModuleInstance.user_id == user_id,
        )
    )
    instance = result.scalars().first()
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module instance not found",
        )
    return ModuleInstanceOut.from_orm_alias(instance)


# ---------------------------------------------------------------------------
# Install endpoint (Phase 4c)
# ---------------------------------------------------------------------------

@router.post("/install", response_model=ModuleInstanceOut, status_code=status.HTTP_201_CREATED)
async def install_module(
    body: ModuleInstallRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ModuleInstanceOut:
    """Install a template as a new ModuleInstance for the current user.

    Creates a ModuleInstance linked to the specified template. The instance
    name defaults to the template name when not provided. After creation an
    audit log entry is written and a WebSocket event is broadcast to the
    owner's active connections.
    """
    # Verify the template exists
    template = await db.get(SDUITemplate, body.template_id)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    instance_name = body.name if body.name else template.name

    instance = ModuleInstance(
        id=str(uuid.uuid4()),
        user_id=user_id,
        template_id=body.template_id,
        module_type=template.category,
        name=instance_name,
        version="1.0.0",
        status="active",
    )
    db.add(instance)

    await log_audit(
        db=db,
        user_id=user_id,
        action_type="install",
        resource_type="module_instance",
        resource_id=instance.id,
        details={"template_id": body.template_id, "name": instance_name},
    )

    await db.commit()
    await db.refresh(instance)

    # Broadcast to all of the owner's active WebSocket connections
    await ws_manager.send(user_id, {
        "type": "module.installed",
        "data": {
            "instance_id": instance.id,
            "template_id": body.template_id,
            "name": instance_name,
        },
    })

    return ModuleInstanceOut.from_orm_alias(instance)


# ---------------------------------------------------------------------------
# Uninstall endpoint (Phase 4c)
# ---------------------------------------------------------------------------

@router.delete("/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def uninstall_module(
    instance_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Uninstall (delete) a ModuleInstance owned by the current user.

    Cascade relationships defined on ModuleInstance (workflows, triggers,
    connections, data_sources, notifications, module_states, screen_histories)
    are deleted automatically by SQLAlchemy's cascade="all, delete-orphan".
    """
    result = await db.execute(
        select(ModuleInstance).where(ModuleInstance.id == instance_id)
    )
    instance = result.scalars().first()

    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module instance not found",
        )
    if instance.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this module instance",
        )

    await log_audit(
        db=db,
        user_id=user_id,
        action_type="uninstall",
        resource_type="module_instance",
        resource_id=instance_id,
        details={"name": instance.name, "template_id": instance.template_id},
    )

    await db.delete(instance)
    await db.commit()

    # Broadcast to all of the owner's active WebSocket connections
    await ws_manager.send(user_id, {
        "type": "module.uninstalled",
        "data": {"instance_id": instance_id},
    })

    return Response(status_code=status.HTTP_204_NO_CONTENT)
