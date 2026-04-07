from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id, require_admin
from app.models.component_registry import ComponentRegistry
from app.models.user import User
from app.schemas.components import ComponentCreate, ComponentOut, ComponentUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/api/components", tags=["components"])


@router.get("/registry", response_model=list[ComponentOut])
async def list_components(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ComponentOut]:
    result = await db.execute(
        select(ComponentRegistry)
        .where(ComponentRegistry.is_active == True)  # noqa: E712
        .order_by(ComponentRegistry.name)
    )
    return [ComponentOut.model_validate(c) for c in result.scalars().all()]


@router.get("/registry/{component_type}", response_model=ComponentOut)
async def get_component(
    component_type: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ComponentOut:
    result = await db.execute(
        select(ComponentRegistry).where(ComponentRegistry.type == component_type)
    )
    component = result.scalar_one_or_none()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")
    return ComponentOut.model_validate(component)


@router.post("/registry", response_model=ComponentOut, status_code=status.HTTP_201_CREATED)
async def create_component(
    body: ComponentCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ComponentOut:
    existing = await db.execute(
        select(ComponentRegistry).where(ComponentRegistry.type == body.type)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Component type '{body.type}' already exists")

    component = ComponentRegistry(**body.model_dump())
    db.add(component)
    await db.flush()

    await log_audit(
        db,
        user_id=str(admin.id),
        action_type="create",
        resource_type="component_registry",
        resource_id=component.id,
        details={"type": body.type},
    )
    return ComponentOut.model_validate(component)


@router.put("/registry/{component_type}", response_model=ComponentOut)
async def update_component(
    component_type: str,
    body: ComponentUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ComponentOut:
    result = await db.execute(
        select(ComponentRegistry).where(ComponentRegistry.type == component_type)
    )
    component = result.scalar_one_or_none()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(component, key, value)
    await db.flush()

    await log_audit(
        db,
        user_id=str(admin.id),
        action_type="update",
        resource_type="component_registry",
        resource_id=component.id,
        details={"type": component_type, "updates": list(updates.keys())},
    )
    return ComponentOut.model_validate(component)


@router.delete("/registry/{component_type}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_component(
    component_type: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ComponentRegistry).where(ComponentRegistry.type == component_type)
    )
    component = result.scalar_one_or_none()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    component.is_active = False
    await db.flush()

    await log_audit(
        db,
        user_id=str(admin.id),
        action_type="soft_delete",
        resource_type="component_registry",
        resource_id=component.id,
        details={"type": component_type},
    )
