from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id, require_admin
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditOut
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/api/audit", tags=["audit"])


def _audit_out(entry: AuditLog) -> AuditOut:
    return AuditOut(
        id=str(entry.id),
        user_id=str(entry.user_id),
        action_type=entry.action_type,
        resource_type=entry.resource_type,
        resource_id=entry.resource_id,
        details_json=entry.details_json,
        ip_address=entry.ip_address,
        created_at=entry.created_at,
    )


async def _list_audit_entries(
    db: AsyncSession,
    pagination: PaginationParams,
    user_id: str | None = None,
    action_type: str | None = None,
    resource_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> PaginatedResponse[AuditOut]:
    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if action_type:
        filters.append(AuditLog.action_type == action_type)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if date_from:
        filters.append(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        filters.append(AuditLog.created_at <= datetime.fromisoformat(date_to))

    count_q = select(func.count()).select_from(AuditLog)
    if filters:
        count_q = count_q.where(*filters)
    total = (await db.execute(count_q)).scalar_one()

    query = select(AuditLog)
    if filters:
        query = query.where(*filters)
    query = (
        query.order_by(AuditLog.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    result = await db.execute(query)
    items = [_audit_out(e) for e in result.scalars().all()]

    return PaginatedResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.get("", response_model=PaginatedResponse[AuditOut])
async def list_audit_entries(
    action_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AuditOut]:
    return await _list_audit_entries(
        db, pagination,
        user_id=user_id,
        action_type=action_type,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/me", response_model=PaginatedResponse[AuditOut])
async def list_my_audit_entries(
    action_type: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    pagination: PaginationParams = Depends(),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[AuditOut]:
    return await _list_audit_entries(
        db, pagination,
        user_id=current_user_id,
        action_type=action_type,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to,
    )
