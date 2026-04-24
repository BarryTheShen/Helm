from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user, get_token_from_request, require_admin
from app.models.device import Device
from app.models.session import Session
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.sessions import SessionOut
from app.services.audit import log_audit

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _session_out(s: Session) -> SessionOut:
    return SessionOut(
        id=str(s.id),
        user_id=str(s.user_id),
        username=s.user.username if s.user else None,
        device_name=s.device.device_name if s.device else None,
        device_id=s.device.device_id if s.device else None,
        is_active=s.is_active,
        created_at=s.created_at,
        expires_at=str(s.expires_at) if s.expires_at else None,
    )


@router.get("", response_model=PaginatedResponse[SessionOut])
async def list_sessions(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count()).select_from(Session).where(Session.is_active.is_(True))
    )).scalar_one()

    result = await db.execute(
        select(Session)
        .where(Session.is_active.is_(True))
        .options(joinedload(Session.user), joinedload(Session.device))
        .order_by(Session.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    items = [_session_out(s) for s in result.scalars().unique().all()]

    return PaginatedResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.get("/me", response_model=PaginatedResponse[SessionOut])
async def list_my_sessions(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)

    total = (await db.execute(
        select(func.count()).select_from(Session).where(
            Session.user_id == user_id, Session.is_active.is_(True)
        )
    )).scalar_one()

    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id, Session.is_active.is_(True))
        .options(joinedload(Session.user), joinedload(Session.device))
        .order_by(Session.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    items = [_session_out(s) for s in result.scalars().unique().all()]

    return PaginatedResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.delete("/me/others", status_code=204)
async def revoke_other_sessions(
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        update(Session)
        .where(
            Session.user_id == str(current_user.id),
            Session.is_active.is_(True),
            Session.token != token,
        )
        .values(is_active=False)
    )
    await db.flush()


@router.delete("/{session_id}", status_code=204)
async def revoke_session(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    # Fetch session with authorization filter to prevent enumeration
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            (Session.user_id == str(current_user.id)) | (current_user.role == "admin")
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False
    await log_audit(db, str(current_user.id), "SESSION_REVOKED", "session", session_id, ip=request.client.host if request.client else None)
    await db.flush()
