from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import BulkDeleteRequest
from app.schemas.notifications import NotificationOut, NotificationsResponse
from app.services.audit import log_audit

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationsResponse)
async def list_notifications(
    unread_only: bool = False,
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_filters = [Notification.user_id == str(current_user.id)]
    if unread_only:
        base_filters.append(Notification.is_read == False)  # noqa: E712

    total = (await db.execute(
        select(func.count()).select_from(Notification).where(*base_filters)
    )).scalar_one()

    query = (
        select(Notification)
        .where(*base_filters)
        .order_by(Notification.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    unread_count = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == str(current_user.id),
            Notification.is_read == False,  # noqa: E712
        )
    )).scalar_one()

    return NotificationsResponse(
        notifications=[
            NotificationOut(
                id=str(n.id),
                title=n.title,
                message=n.message,
                severity=n.severity,
                is_read=n.is_read,
                actions=n.actions,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        unread_count=unread_count,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == str(current_user.id),
        )
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
    await log_audit(db, str(current_user.id), "NOTIFICATION_READ", "notification", notification_id, ip=request.client.host if request.client else None)
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_read(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import update
    await db.execute(
        update(Notification)
        .where(Notification.user_id == str(current_user.id))
        .values(is_read=True)
    )
    await log_audit(db, str(current_user.id), "NOTIFICATION_READ_ALL", "notification", ip=request.client.host if request.client else None)
    return {"message": "All notifications marked as read"}


@router.post("/bulk-delete")
async def bulk_delete_notifications(
    body: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Notification).where(
            Notification.id.in_(body.ids),
            Notification.user_id == str(current_user.id),
        )
    )
    await db.commit()
    return {"deleted": result.rowcount}
