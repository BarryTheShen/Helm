from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id
from app.models.workflow import Workflow
from app.schemas.common import BulkDeleteRequest, PaginatedResponse
from app.services.audit import log_audit
from app.services.workflow_engine import register_workflow, unregister_workflow

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    graph: dict[str, Any] = {}
    trigger_type: str  # onSchedule | onDataChange | onServerEvent | manual
    trigger_config: dict[str, Any] = {}
    enabled: bool = True


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    graph: dict[str, Any] | None = None
    trigger_config: dict[str, Any] | None = None
    enabled: bool | None = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str | None
    graph: dict[str, Any]
    trigger_type: str
    trigger_config: dict[str, Any]
    enabled: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


@router.get("", response_model=PaginatedResponse[WorkflowResponse])
async def list_workflows(
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count()).select_from(Workflow).where(Workflow.user_id == user_id)
    )).scalar_one()

    result = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == user_id)
        .order_by(Workflow.created_at)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    workflows = result.scalars().all()
    items = [
        WorkflowResponse(
            id=str(w.id),
            name=w.name,
            description=w.description,
            graph=w.graph or {},
            trigger_type=w.trigger_type,
            trigger_config=w.trigger_config or {},
            enabled=w.enabled,
            created_at=w.created_at.isoformat(),
            updated_at=w.updated_at.isoformat(),
        )
        for w in workflows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    wf = Workflow(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        description=body.description,
        graph=body.graph,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config,
        enabled=body.enabled,
    )
    db.add(wf)
    await log_audit(db, user_id, "WORKFLOW_CREATED", "workflow", str(wf.id), ip=request.client.host if request.client else None)

    # Capture values before commit to avoid lazy loading issues
    wf_id = str(wf.id)
    wf_name = wf.name
    wf_description = wf.description
    wf_graph = wf.graph or {}
    wf_trigger_type = wf.trigger_type
    wf_trigger_config = wf.trigger_config or {}
    wf_enabled = wf.enabled

    await db.commit()
    await db.refresh(wf)  # Refresh to get server-generated timestamps

    await register_workflow(wf_id, wf_trigger_type, wf_trigger_config, wf_enabled)
    return WorkflowResponse(
        id=wf_id,
        name=wf_name,
        description=wf_description,
        graph=wf_graph,
        trigger_type=wf_trigger_type,
        trigger_config=wf_trigger_config,
        enabled=wf_enabled,
        created_at=wf.created_at.isoformat(),
        updated_at=wf.updated_at.isoformat(),
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
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

    return WorkflowResponse(
        id=str(wf.id),
        name=wf.name,
        description=wf.description,
        graph=wf.graph or {},
        trigger_type=wf.trigger_type,
        trigger_config=wf.trigger_config or {},
        enabled=wf.enabled,
        created_at=wf.created_at.isoformat(),
        updated_at=wf.updated_at.isoformat(),
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    request: Request,
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
    if body.description is not None:
        wf.description = body.description
    if body.graph is not None:
        wf.graph = body.graph
    if body.trigger_config is not None:
        wf.trigger_config = body.trigger_config
    if body.enabled is not None:
        wf.enabled = body.enabled
        if not body.enabled:
            await unregister_workflow(workflow_id)
    await log_audit(db, user_id, "WORKFLOW_UPDATED", "workflow", str(wf.id), ip=request.client.host if request.client else None)

    # Capture values before commit to avoid lazy loading issues
    wf_id = str(wf.id)
    wf_name = wf.name
    wf_description = wf.description
    wf_graph = wf.graph or {}
    wf_trigger_type = wf.trigger_type
    wf_trigger_config = wf.trigger_config or {}
    wf_enabled = wf.enabled

    await db.commit()
    await db.refresh(wf)  # Refresh to get updated timestamp

    # Register workflow after commit to avoid session issues
    if body.enabled is not None and body.enabled:
        await register_workflow(workflow_id, wf_trigger_type, wf_trigger_config, wf_enabled)

    return WorkflowResponse(
        id=wf_id,
        name=wf_name,
        description=wf_description,
        graph=wf_graph,
        trigger_type=wf_trigger_type,
        trigger_config=wf_trigger_config,
        enabled=wf_enabled,
        created_at=wf.created_at.isoformat(),
        updated_at=wf.updated_at.isoformat(),
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    request: Request,
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
    await log_audit(db, user_id, "WORKFLOW_DELETED", "workflow", workflow_id, ip=request.client.host if request.client else None)
    await db.delete(wf)
    await db.commit()


class WorkflowExecuteResponse(BaseModel):
    status: str
    message: str


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse)
async def execute_workflow(
    workflow_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually execute a workflow."""
    from app.services.workflow_engine import _execute_workflow

    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
    )
    wf = result.scalar_one_or_none()
    if wf is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Execute workflow asynchronously
    await _execute_workflow(workflow_id, event_data={"trigger": "manual"})

    return WorkflowExecuteResponse(
        status="success",
        message=f"Workflow '{wf.name}' executed successfully"
    )


@router.post("/bulk-delete")
async def bulk_delete_workflows(
    body: BulkDeleteRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Workflow).where(
            Workflow.id.in_(body.ids),
            Workflow.user_id == user_id,
        )
    )
    await db.commit()
    return {"deleted": result.rowcount}


class N8nImportRequest(BaseModel):
    workflow: dict[str, Any]


class N8nImportResponse(BaseModel):
    workflow: dict[str, Any]
    warnings: list[str]


@router.post("/import/n8n", response_model=N8nImportResponse)
async def import_n8n_workflow(
    body: N8nImportRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Import n8n workflow JSON and translate to Helm workflow format.

    n8n format:
    {
        "name": "...",
        "nodes": [{"id": "...", "type": "...", "parameters": {...}, "position": [x, y]}],
        "connections": {"node_id": {"main": [[{"node": "target_id", "type": "main", "index": 0}]]}}
    }

    Helm format (React Flow):
    {
        "nodes": [{"id": "...", "type": "action", "data": {...}, "position": {"x": x, "y": y}}],
        "edges": [{"id": "...", "source": "...", "target": "..."}]
    }
    """
    n8n_wf = body.workflow
    warnings: list[str] = []

    # Node type mapping
    node_type_map = {
        "n8n-nodes-base.httpRequest": "action",
        "n8n-nodes-base.webhook": "action",
        "n8n-nodes-base.set": "action",
        "n8n-nodes-base.if": "condition",
        "n8n-nodes-base.switch": "switch",
        "n8n-nodes-base.code": "action",
        "n8n-nodes-base.function": "action",
        "n8n-nodes-base.merge": "action",
        "n8n-nodes-base.splitInBatches": "loop",
    }

    # Translate nodes
    helm_nodes = []
    for n8n_node in n8n_wf.get("nodes", []):
        node_id = n8n_node.get("id") or n8n_node.get("name", str(uuid4()))
        node_type = n8n_node.get("type", "")
        helm_type = node_type_map.get(node_type, "action")

        if node_type not in node_type_map:
            warnings.append(f"Unsupported node type '{node_type}' (node: {node_id}) — mapped to 'action'")

        position = n8n_node.get("position", [0, 0])
        helm_nodes.append({
            "id": node_id,
            "type": helm_type,
            "data": {
                "label": n8n_node.get("name", node_id),
                "action": node_type,
                "params": n8n_node.get("parameters", {}),
                "n8n_original_type": node_type,
            },
            "position": {"x": position[0] if len(position) > 0 else 0, "y": position[1] if len(position) > 1 else 0},
        })

    # Translate connections
    helm_edges = []
    connections = n8n_wf.get("connections", {})
    for source_id, outputs in connections.items():
        main_outputs = outputs.get("main", [])
        for output_index, targets in enumerate(main_outputs):
            for target in targets:
                target_id = target.get("node")
                if target_id:
                    edge_id = f"{source_id}-{target_id}-{output_index}"
                    helm_edges.append({
                        "id": edge_id,
                        "source": source_id,
                        "target": target_id,
                        "sourceHandle": str(output_index) if output_index > 0 else None,
                    })

    helm_workflow = {
        "nodes": helm_nodes,
        "edges": helm_edges,
    }

    return N8nImportResponse(workflow=helm_workflow, warnings=warnings)
