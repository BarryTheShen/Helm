"""ModuleInstance router — read-only endpoints for Phase 4a.

Install/uninstall (POST /api/modules/install, DELETE /api/modules/{id}) are
deferred to Phase 4c so that the data model can be validated in production
before write paths go live.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models.module_instance import ModuleInstance
from app.schemas.module_instance import ModuleInstanceOut

router = APIRouter(prefix="/api/modules/instances", tags=["module-instances"])


@router.get("", response_model=list[ModuleInstanceOut])
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


@router.get("/{instance_id}", response_model=ModuleInstanceOut)
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
