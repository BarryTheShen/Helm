from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.settings import Settings
from app.models.user import User
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.utils.security import hash_password

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _settings_out(s: Settings) -> SettingsOut:
    return SettingsOut(
        id=str(s.id),
        user_id=str(s.user_id),
        display_name=s.display_name,
        email=s.email,
        endpoint_url=s.endpoint_url,
        dark_mode=s.dark_mode,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@router.get("", response_model=SettingsOut)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettingsOut:
    """Get current user's settings."""
    result = await db.execute(
        select(Settings).where(Settings.user_id == str(current_user.id))
    )
    settings = result.scalars().first()

    # Create default settings if none exist
    if settings is None:
        settings = Settings(
            id=str(uuid4()),
            user_id=str(current_user.id),
            dark_mode=False,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return _settings_out(settings)


@router.patch("", response_model=SettingsOut)
async def update_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettingsOut:
    """Update current user's settings."""
    result = await db.execute(
        select(Settings).where(Settings.user_id == str(current_user.id))
    )
    settings = result.scalars().first()

    # Create settings if none exist
    if settings is None:
        settings = Settings(
            id=str(uuid4()),
            user_id=str(current_user.id),
            dark_mode=False,
        )
        db.add(settings)

    # Update fields
    if body.display_name is not None:
        settings.display_name = body.display_name

    if body.email is not None:
        settings.email = body.email

    if body.endpoint_url is not None:
        settings.endpoint_url = body.endpoint_url

    if body.dark_mode is not None:
        settings.dark_mode = body.dark_mode

    if body.password is not None:
        settings.password_hash = hash_password(body.password)

    await db.commit()
    await db.refresh(settings)

    return _settings_out(settings)
