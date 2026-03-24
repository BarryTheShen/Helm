from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models.workflow import Workflow, TriggerType
from app.services.workflow_engine import register_workflow, unregister_workflow

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class WorkflowCreate(BaseModel):
    name: str
    trigger_type: TriggerType
    trigger_config: dict[str, Any] = {}
    action_config: dict[str, Any] = {}


class WorkflowUpdate(BaseModel):
    name: str | None = None
    trigger_config: dict[str, Any] | None = None
    action_config: dict[str, Any] | None = None
    is_active: bool | None = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    trigger_type: str
    trigger_config: dict[str, Any]
    action_config: dict[str, Any]
    is_active: bool
    run_count: int
    last_run_at: str | None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.user_id == user_id).order_by(Workflow.created_at)
    )
    workflows = result.scalars().all()
    return [
        WorkflowResponse(
            id=str(w.id),
            name=w.name,
            trigger_type=w.trigger_type.value,
            trigger_config=w.trigger_config or {},
            action_config=w.action_config or {},
            is_active=w.is_active,
            run_count=w.run_count or 0,
            last_run_at=w.last_run_at.isoformat() if w.last_run_at else None,
        )
        for w in workflows
    ]


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    wf = Workflow(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config,
        action_config=body.action_config,
    )
    db.add(wf)
    await db.commit()
    await register_workflow(wf)
    return WorkflowResponse(
        id=str(wf.id),
        name=wf.name,
        trigger_type=wf.trigger_type.value,
        trigger_config=wf.trigger_config or {},
        action_config=wf.action_config or {},
        is_active=wf.is_active,
        run_count=0,
        last_run_at=None,
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    wf = result.scalar_one_or_none()
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if body.name is not None:
        wf.name = body.name
    if body.trigger_config is not None:
        wf.trigger_config = body.trigger_config
    if body.action_config is not None:
        wf.action_config = body.action_config
    if body.is_active is not None:
        wf.is_active = body.is_active
        if not body.is_active:
            await unregister_workflow(workflow_id)
        else:
            await register_workflow(wf)
    await db.commit()
    return WorkflowResponse(
        id=str(wf.id),
        name=wf.name,
        trigger_type=wf.trigger_type.value,
        trigger_config=wf.trigger_config or {},
        action_config=wf.action_config or {},
        is_active=wf.is_active,
        run_count=wf.run_count or 0,
        last_run_at=wf.last_run_at.isoformat() if wf.last_run_at else None,
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    wf = result.scalar_one_or_none()
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await unregister_workflow(workflow_id)
    await db.delete(wf)
    await db.commit()
