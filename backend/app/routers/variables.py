from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id
from app.models.custom_variable import CustomVariable
from app.schemas.common import PaginatedResponse
from app.schemas.custom_variable import (
    CustomVariableCreate,
    CustomVariableOut,
    CustomVariableUpdate,
)
from app.services.audit import log_audit

router = APIRouter(prefix="/api/variables", tags=["variables"])


@router.get("", response_model=PaginatedResponse[CustomVariableOut])
async def list_variables(
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count()).select_from(CustomVariable).where(CustomVariable.user_id == user_id)
    )).scalar_one()

    result = await db.execute(
        select(CustomVariable)
        .where(CustomVariable.user_id == user_id)
        .order_by(CustomVariable.created_at)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    variables = result.scalars().all()

    return PaginatedResponse(
        items=[CustomVariableOut.model_validate(v) for v in variables],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("", response_model=CustomVariableOut, status_code=status.HTTP_201_CREATED)
async def create_variable(
    body: CustomVariableCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate name
    existing = (await db.execute(
        select(CustomVariable).where(
            CustomVariable.user_id == user_id,
            CustomVariable.name == body.name,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Variable '{body.name}' already exists",
        )

    variable = CustomVariable(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        value=body.value,
        type=body.type,
        description=body.description,
    )
    db.add(variable)
    await db.commit()
    await db.refresh(variable)

    await log_audit(
        db, user_id, "VARIABLE_CREATED", "custom_variable", variable.id,
        ip=request.client.host if request.client else None,
    )

    return CustomVariableOut.model_validate(variable)


@router.put("/{variable_id}", response_model=CustomVariableOut)
async def update_variable(
    variable_id: str,
    body: CustomVariableUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomVariable).where(
            CustomVariable.id == variable_id,
            CustomVariable.user_id == user_id,
        )
    )
    variable = result.scalar_one_or_none()
    if variable is None:
        raise HTTPException(status_code=404, detail="Variable not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(variable, field, value)

    await db.commit()
    await db.refresh(variable)

    await log_audit(
        db, user_id, "VARIABLE_UPDATED", "custom_variable", variable.id,
        ip=request.client.host if request.client else None,
    )

    return CustomVariableOut.model_validate(variable)


@router.delete("/{variable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variable(
    variable_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomVariable).where(
            CustomVariable.id == variable_id,
            CustomVariable.user_id == user_id,
        )
    )
    variable = result.scalar_one_or_none()
    if variable is None:
        raise HTTPException(status_code=404, detail="Variable not found")

    await db.delete(variable)
    await db.commit()

    await log_audit(
        db, user_id, "VARIABLE_DELETED", "custom_variable", variable_id,
        ip=request.client.host if request.client else None,
    )
