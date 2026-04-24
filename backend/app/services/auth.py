from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.device import Device
from app.models.session import Session
from app.models.user import User
from app.utils.security import (
    create_access_token,
    hash_password,
    verify_password,
)


async def is_setup_complete(db: AsyncSession) -> bool:
    result = await db.execute(select(User).limit(1))
    return result.scalar_one_or_none() is not None


async def create_first_user(db: AsyncSession, username: str, password: str) -> User:
    user = User(
        id=str(uuid4()),
        username=username,
        password_hash=hash_password(password),
        role="admin",
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def upsert_device(
    db: AsyncSession, user_id: str, device_id: str, device_name: str
) -> Device:
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        device = Device(
            id=str(uuid4()),
            user_id=user_id,
            device_id=device_id,
            device_name=device_name,
            config_json={
                "tab_bar_modules": ["chat", "calendar", "alerts"],
                "default_module": "chat",
                "nav_mode": "tabs",
            },
        )
        db.add(device)
    else:
        device.last_seen = datetime.now(timezone.utc)
    await db.flush()
    return device


async def create_session(
    db: AsyncSession, user_id: str, device_id: str
) -> Session:
    # Invalidate existing active sessions for this device atomically
    from sqlalchemy import update
    await db.execute(
        update(Session)
        .where(
            Session.device_id == device_id,
            Session.is_active == True,  # noqa: E712
        )
        .values(is_active=False)
    )
    await db.flush()

    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.access_token_expire_hours
    )
    token = create_access_token(
        subject=user_id, extra={"device_id": device_id}
    )
    session = Session(
        id=str(uuid4()),
        user_id=user_id,
        device_id=device_id,
        token=token,
        expires_at=expires_at,
        is_active=True,
    )
    db.add(session)
    await db.flush()
    return session


async def get_session_by_token(
    db: AsyncSession, token: str
) -> Session | None:
    result = await db.execute(
        select(Session).where(
            Session.token == token,
            Session.is_active == True,  # noqa: E712
            Session.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none()


async def invalidate_session(db: AsyncSession, token: str) -> None:
    from loguru import logger
    result = await db.execute(
        select(Session).where(Session.token == token)
    )
    session = result.scalar_one_or_none()
    if session:
        session.is_active = False
        logger.info(f"Session invalidated: user_id={session.user_id}, device_id={session.device_id}")
    else:
        logger.warning(f"Attempted to invalidate non-existent session")
