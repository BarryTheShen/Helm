from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, require_admin
from app.models.audit_log import AuditLog
from app.models.calendar_event import CalendarEvent
from app.models.module_state import ModuleState
from app.models.notification import Notification
from app.models.session import Session
from app.models.template import SDUITemplate
from app.models.user import User
from app.models.workflow import Workflow
from app.schemas.admin import (
    AdminStatsOut,
    WebSocketConnectionOut,
    WebSocketStatsOut,
    WorkflowAnalyticsItem,
)
from app.schemas.common import PaginatedResponse
from app.services.websocket_manager import manager

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStatsOut:
    """Dashboard summary — aggregate counts across all tables."""
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    active_sessions = (await db.execute(
        select(func.count()).select_from(Session).where(Session.is_active == True)  # noqa: E712
    )).scalar_one()
    total_events = (await db.execute(select(func.count()).select_from(CalendarEvent))).scalar_one()
    total_workflows = (await db.execute(select(func.count()).select_from(Workflow))).scalar_one()
    active_workflows = (await db.execute(
        select(func.count()).select_from(Workflow).where(Workflow.is_active == True)  # noqa: E712
    )).scalar_one()
    total_notifications = (await db.execute(select(func.count()).select_from(Notification))).scalar_one()
    unread_notifications = (await db.execute(
        select(func.count()).select_from(Notification).where(Notification.is_read == False)  # noqa: E712
    )).scalar_one()
    total_screens = (await db.execute(
        select(func.count()).select_from(ModuleState).where(
            ModuleState.module_type.like("sdui__%"),
            ~ModuleState.module_type.like("%__draft%"),
        )
    )).scalar_one()
    total_templates = (await db.execute(select(func.count()).select_from(SDUITemplate))).scalar_one()
    total_audit_entries = (await db.execute(select(func.count()).select_from(AuditLog))).scalar_one()

    return AdminStatsOut(
        total_users=total_users,
        active_sessions=active_sessions,
        connected_ws_clients=len(manager.get_all_connections()),
        total_events=total_events,
        total_workflows=total_workflows,
        active_workflows=active_workflows,
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
        total_screens=total_screens,
        total_templates=total_templates,
        total_audit_entries=total_audit_entries,
    )


@router.get("/stats/workflows", response_model=PaginatedResponse[WorkflowAnalyticsItem])
async def get_workflow_analytics(
    _admin: User = Depends(require_admin),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[WorkflowAnalyticsItem]:
    """Per-workflow analytics with audit entry counts."""
    total = (await db.execute(select(func.count()).select_from(Workflow))).scalar_one()

    # Subquery: count WORKFLOW_* audit entries per resource_id
    audit_sub = (
        select(
            AuditLog.resource_id,
            func.count().label("audit_count"),
        )
        .where(AuditLog.action_type.like("WORKFLOW_%"))
        .group_by(AuditLog.resource_id)
        .subquery()
    )

    query = (
        select(
            Workflow.id,
            Workflow.name,
            Workflow.is_active,
            Workflow.run_count,
            Workflow.last_run_at,
            func.coalesce(audit_sub.c.audit_count, 0).label("audit_entries"),
        )
        .outerjoin(audit_sub, Workflow.id == audit_sub.c.resource_id)
        .order_by(Workflow.created_at.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    rows = (await db.execute(query)).all()

    items = [
        WorkflowAnalyticsItem(
            id=row.id,
            name=row.name,
            is_active=row.is_active,
            run_count=row.run_count,
            last_run_at=row.last_run_at,
            audit_entries=row.audit_entries,
        )
        for row in rows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < total,
    )


@router.get("/stats/websocket", response_model=WebSocketStatsOut)
async def get_websocket_stats(
    _admin: User = Depends(require_admin),
) -> WebSocketStatsOut:
    """Live WebSocket connection info from in-memory tracking."""
    return WebSocketStatsOut(
        connected_users=[
            WebSocketConnectionOut(
                user_id=user_id,
                device_id=conn.device_id,
                connected_since=conn.connected_since,
            )
            for user_id, conn in manager.get_all_connections()
        ]
    )
