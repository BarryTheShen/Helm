import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id
from app.models.trigger import TriggerDefinition
from app.schemas.common import PaginatedResponse
from app.schemas.trigger import TriggerCreate, TriggerOut, TriggerUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/api/triggers", tags=["triggers"])


@router.get("", response_model=PaginatedResponse[TriggerOut])
async def list_triggers(
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count()).select_from(TriggerDefinition).where(TriggerDefinition.user_id == user_id)
    )).scalar_one()

    result = await db.execute(
        select(TriggerDefinition)
        .where(TriggerDefinition.user_id == user_id)
        .order_by(TriggerDefinition.created_at)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    triggers = result.scalars().all()

    return PaginatedResponse(
        items=[TriggerOut.model_validate(t) for t in triggers],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("", response_model=TriggerOut, status_code=status.HTTP_201_CREATED)
async def create_trigger(
    body: TriggerCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # `schedule` triggers were removed from TriggerDefinition in Phase 1.
    # Cron scheduling belongs to Workflow.trigger_type == "onSchedule" (workflow_engine).
    # This guard handles any client that bypasses Pydantic validation (e.g. raw HTTP).
    if body.trigger_type == "schedule":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "TriggerDefinition no longer supports trigger_type='schedule'. "
                "Use a Workflow with trigger_type='onSchedule' for cron-based scheduling."
            ),
        )
    trigger = TriggerDefinition(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        trigger_type=body.trigger_type,
        config_json=body.config_json,
        action_chain_json=body.action_chain_json,
        enabled=body.enabled,
    )
    db.add(trigger)
    await db.commit()
    await db.refresh(trigger)

    await log_audit(
        db, user_id, "TRIGGER_CREATED", "trigger_definition", trigger.id,
        ip=request.client.host if request.client else None,
    )

    return TriggerOut.model_validate(trigger)


@router.put("/{trigger_id}", response_model=TriggerOut)
async def update_trigger(
    trigger_id: str,
    body: TriggerUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TriggerDefinition).where(
            TriggerDefinition.id == trigger_id,
            TriggerDefinition.user_id == user_id,
        )
    )
    trigger = result.scalars().first()
    if trigger is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trigger, field, value)

    await db.commit()
    await db.refresh(trigger)

    await log_audit(
        db, user_id, "TRIGGER_UPDATED", "trigger_definition", trigger.id,
        ip=request.client.host if request.client else None,
    )

    return TriggerOut.model_validate(trigger)


@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(
    trigger_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TriggerDefinition).where(
            TriggerDefinition.id == trigger_id,
            TriggerDefinition.user_id == user_id,
        )
    )
    trigger = result.scalars().first()
    if trigger is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")

    await db.delete(trigger)
    await db.commit()

    await log_audit(
        db, user_id, "TRIGGER_DELETED", "trigger_definition", trigger_id,
        ip=request.client.host if request.client else None,
    )


@router.post("/{trigger_id}/test")
async def test_trigger(
    trigger_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually fire a trigger for testing purposes."""
    result = await db.execute(
        select(TriggerDefinition).where(
            TriggerDefinition.id == trigger_id,
            TriggerDefinition.user_id == user_id,
        )
    )
    trigger = result.scalars().first()
    if trigger is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")

    from app.services.trigger_engine import fire_trigger
    fire_result = await fire_trigger(trigger, db)
    return {"status": "ok", "trigger_id": trigger_id, "result": fire_result}
