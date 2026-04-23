from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth import get_session_by_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    session = await get_session_by_token(db, credentials.credentials)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Enforce idle timeout: reject sessions that have not been used recently.
    now = datetime.now(timezone.utc)
    idle_cutoff = now - timedelta(hours=settings.session_idle_timeout_hours)
    last_active = session.last_active
    # Normalise naive datetimes from SQLite (which strips tzinfo) to UTC.
    if last_active.tzinfo is None:
        last_active = last_active.replace(tzinfo=timezone.utc)
    if last_active < idle_cutoff:
        session.is_active = False
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired due to inactivity",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Bump last_active so the idle clock resets on every successful request.
    session.last_active = now
    await db.commit()

    user = await db.get(User, session.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


async def get_token_from_request(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return credentials.credentials


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_current_user_id(
    user: User = Depends(get_current_user),
) -> str:
    return str(user.id)


class PaginationParams:
    def __init__(
        self,
        limit: int = Query(default=50, le=200),
        offset: int = Query(default=0, ge=0),
    ):
        self.limit = limit
        self.offset = offset
