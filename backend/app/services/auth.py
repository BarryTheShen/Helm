from datetime import datetime, timedelta, timezone
from uuid import uuid4

from loguru import logger
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
    has_users = result.scalar_one_or_none() is not None
    logger.info(f"is_setup_complete() → {'yes' if has_users else 'no'}")
    return has_users


async def create_first_user(db: AsyncSession, username: str, password: str) -> User:
    logger.info(f"create_first_user() — creating admin user: {username}")
    user = User(
        id=str(uuid4()),
        username=username,
        password_hash=hash_password(password),
        role="admin",
    )
    db.add(user)
    await db.flush()
    logger.info(f"create_first_user() — created user_id={user.id}")
    return user


async def authenticate_user(
    db: AsyncSession, username: str, password: str
) -> User | None:
    logger.debug(f"authenticate_user() — username: {username}")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        logger.warning(f"authenticate_user() — user not found: {username}")
        return None
    if not verify_password(password, user.password_hash):
        logger.warning(f"authenticate_user() — invalid password for user: {username}")
        return None
    logger.info(f"authenticate_user() — success: {username} (id={user.id})")
    return user


async def upsert_device(
    db: AsyncSession, user_id: str, device_id: str, device_name: str
) -> Device:
    logger.info(f"upsert_device() — user={user_id}, device={device_id}, name={device_name}")
    result = await db.execute(
        select(Device).where(Device.device_id == device_id)
    )
    device = result.scalar_one_or_none()
    if device is None:
        logger.info(f"upsert_device() — new device created: {device_name}")
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
        logger.info(f"upsert_device() — existing device updated, last_seen refresh")
        device.last_seen = datetime.now(timezone.utc)
    await db.flush()
    return device


async def create_session(
    db: AsyncSession, user_id: str, device_id: str
) -> Session:
    from sqlalchemy import update
    logger.info(f"create_session() — user={user_id}, device={device_id}")
    # Invalidate existing active sessions for this device atomically
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
    logger.info(f"create_session() — session created: id={session.id}, expires={expires_at}")
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
    session = result.scalar_one_or_none()
    if session:
        logger.debug(f"get_session_by_token() — valid session found: user={session.user_id}")
    else:
        logger.debug("get_session_by_token() — no valid session found")
    return session


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
