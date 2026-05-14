"""Seed sample custom variables into the database for testing and demonstration."""
import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.custom_variable import CustomVariable
from app.models.user import User


SAMPLE_VARIABLES = [
    {"name": "user.name", "value": "Barry", "type": "text", "description": "User display name"},
    {"name": "app.theme", "value": "light", "type": "text", "description": "Default app theme (light or dark)"},
    {"name": "greeting.morning", "value": "Good morning!", "type": "text", "description": "Morning greeting message"},
    {"name": "greeting.evening", "value": "Good evening!", "type": "text", "description": "Evening greeting message"},
    {"name": "app.title", "value": "Helm", "type": "text", "description": "App display title"},
    {"name": "app.showWeather", "value": "true", "type": "boolean", "description": "Whether to show weather on dashboard"},
    {"name": "app.maxTodos", "value": "10", "type": "number", "description": "Maximum todos to display"},
    {"name": "notifications.enabled", "value": "true", "type": "boolean", "description": "Whether notifications are enabled"},
]


async def seed_sample_variables(db: AsyncSession) -> None:
    """Insert sample custom variables for the first user if none exist."""
    count = (await db.execute(select(func.count()).select_from(CustomVariable))).scalar_one()
    if count > 0:
        logger.info(f"Custom variables table already has {count} entries — skipping sample seed")
        return

    # Find the first user to associate variables with
    user_result = await db.execute(select(User).order_by(User.created_at.asc()).limit(1))
    first_user = user_result.scalar_one_or_none()

    if not first_user:
        logger.info("No users found — skipping variable seed (data will be empty until users create variables)")
        return

    for data in SAMPLE_VARIABLES:
        db.add(CustomVariable(
            id=str(uuid.uuid4()),
            user_id=str(first_user.id),
            **data,
        ))

    await db.commit()
    logger.info(f"Seeded {len(SAMPLE_VARIABLES)} sample variables for user {first_user.id}")
