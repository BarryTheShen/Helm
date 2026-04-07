from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, get_token_from_request
from app.services.audit import log_audit
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    RefreshResponse,
    SetupRequest,
    SetupResponse,
    StatusResponse,
)
from app.services.auth import (
    authenticate_user,
    create_first_user,
    create_session,
    get_session_by_token,
    invalidate_session,
    is_setup_complete,
    upsert_device,
)
from app.utils.security import create_access_token
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status", response_model=StatusResponse)
async def auth_status(db: AsyncSession = Depends(get_db)):
    setup = await is_setup_complete(db)
    return StatusResponse(
        setup_complete=setup,
        server_name=settings.server_name,
        version=settings.server_version,
    )


@router.post("/setup", response_model=SetupResponse, status_code=status.HTTP_201_CREATED)
async def setup(body: SetupRequest, db: AsyncSession = Depends(get_db)):
    """Create the first user.

    Locked after first user is created — returns 409 if server is already set up.
    Architecture Decision: Session 2, Section 11 — CLI-only user creation preferred.
    This endpoint is kept for initial setup only; additional users should use CLI.
    """
    if await is_setup_complete(db):
        raise HTTPException(status_code=409, detail="Server already set up. Use CLI to create additional users.")
    user = await create_first_user(db, body.username, body.password)
    return SetupResponse(user_id=str(user.id), message="Setup complete")


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    device = await upsert_device(db, str(user.id), body.device_id, body.device_name)
    session = await create_session(db, str(user.id), str(device.id))
    await log_audit(db, str(user.id), "USER_LOGIN", "session", str(session.id), ip=request.client.host if request.client else None)
    return LoginResponse(
        session_token=session.token,
        expires_at=session.expires_at,
        user_id=str(user.id),
        username=user.username,
        role=user.role,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
):
    from app.models.session import Session
    from uuid import uuid4

    # Get device_id from the old session before invalidating
    old_session = await get_session_by_token(db, token)
    device_id = old_session.device_id if old_session else None

    await invalidate_session(db, token)

    if device_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot refresh: no device associated with session",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.access_token_expire_hours
    )
    new_token = create_access_token(
        subject=str(current_user.id), extra={"device_id": device_id}
    )
    new_session = Session(
        id=str(uuid4()),
        user_id=str(current_user.id),
        device_id=device_id,
        token=new_token,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(new_session)
    return RefreshResponse(session_token=new_token, expires_at=expires_at)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
):
    await invalidate_session(db, token)
    await log_audit(db, str(current_user.id), "USER_LOGOUT", "session", ip=request.client.host if request.client else None)
    return LogoutResponse(message="Logged out")
