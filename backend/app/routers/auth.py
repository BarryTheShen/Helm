from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, get_token_from_request
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
    if await is_setup_complete(db):
        raise HTTPException(status_code=409, detail="Server already set up")
    user = await create_first_user(db, body.username, body.password)
    return SetupResponse(user_id=str(user.id), message="Setup complete")


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    device = await upsert_device(db, str(user.id), body.device_id, body.device_name)
    session = await create_session(db, str(user.id), str(device.id))
    return LoginResponse(
        session_token=session.token,
        expires_at=session.expires_at,
        user_id=str(user.id),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    current_user: User = Depends(get_current_user),
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
):
    await invalidate_session(db, token)
    # Get device_id from old token — create a bare new session
    from app.services.auth import get_session_by_token as _get  # already invalidated, use new
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    new_token = create_access_token(subject=str(current_user.id))
    from app.models.session import Session
    from uuid import uuid4
    new_session = Session(
        id=str(uuid4()),
        user_id=str(current_user.id),
        device_id=None,
        token=new_token,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(new_session)
    return RefreshResponse(session_token=new_token, expires_at=expires_at)


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    token: str = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
):
    await invalidate_session(db, token)
    return LogoutResponse(message="Logged out")
