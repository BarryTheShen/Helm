"""Seed canonical data sources used by templates and mobile components."""

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_source import DataSource
from app.models.user import User

# Stable IDs match template dataBinding.dataSourceId values (FF4-TPL-001).
SAMPLE_DATA_SOURCES = [
    {
        "id": "calendar_events",
        "name": "Calendar Events",
        "type": "calendar",
        "connector": "local_db",
        "config_json": "{}",
    },
    {
        "id": "todos",
        "name": "Todos",
        "type": "todos",
        "connector": "local_db",
        "config_json": "{}",
    },
    {
        "id": "notes",
        "name": "Notes",
        "type": "notes",
        "connector": "local_db",
        "config_json": "{}",
    },
    {
        "id": "articles",
        "name": "Articles",
        "type": "custom",
        "connector": "rss_feed",
        "config_json": '{"feed_url": "https://news.ycombinator.com/rss"}',
    },
    {
        "id": "chat_messages",
        "name": "Chat Messages",
        "type": "chat",
        "connector": "local_db",
        "config_json": "{}",
    },
]


async def seed_sample_data_sources(db: AsyncSession) -> None:
    """Insert canonical data sources for the first user if none exist."""
    count = (await db.execute(select(func.count()).select_from(DataSource))).scalar_one()
    if count > 0:
        logger.info(f"Data sources table already has {count} entries — skipping sample seed")
        return

    user_result = await db.execute(select(User).order_by(User.created_at.asc()).limit(1))
    first_user = user_result.scalar_one_or_none()
    if not first_user:
        logger.info("No users found — skipping data source seed")
        return

    for data in SAMPLE_DATA_SOURCES:
        db.add(DataSource(
            id=data["id"],
            user_id=str(first_user.id),
            name=data["name"],
            type=data["type"],
            connector=data["connector"],
            config_json=data["config_json"],
        ))

    await db.commit()
    logger.info(f"Seeded {len(SAMPLE_DATA_SOURCES)} sample data sources for user {first_user.id}")
