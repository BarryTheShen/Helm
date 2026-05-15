"""Seed sample workflows into the database for testing and demonstration."""
import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workflow import Workflow


SAMPLE_WORKFLOWS = [
    {
        "name": "Daily Summary",
        "description": "Sends a notification at 9am with today's calendar events and tasks",
        "trigger_type": "onSchedule",
        "trigger_config": {
            "cron": "0 9 * * *",
            "timezone": "UTC",
        },
        "graph": {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "position": {"x": 250, "y": 0},
                    "data": {"label": "Daily at 9am", "trigger_type": "onSchedule", "trigger_config": {"cron": "0 9 * * *"}},
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "position": {"x": 250, "y": 150},
                    "data": {"label": "Fetch Today's Events", "tool": "read_all_calendar", "args": {}},
                },
                {
                    "id": "action-2",
                    "type": "action",
                    "position": {"x": 250, "y": 300},
                    "data": {"label": "Send Summary", "tool": "send_notification", "args": {"title": "☀️ Daily Summary", "message": "Good morning! Here's your day ahead.", "severity": "info"}},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger-1", "target": "action-1"},
                {"id": "e2-3", "source": "action-1", "target": "action-2"},
            ],
        },
        "enabled": False,
    },
    {
        "name": "Event Reminder",
        "description": "Sends a notification 15 minutes before a calendar event starts",
        "trigger_type": "onServerEvent",
        "trigger_config": {
            "event": "calendar_event_upcoming",
            "lead_time_minutes": 15,
        },
        "graph": {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "position": {"x": 250, "y": 0},
                    "data": {"label": "Event Starting Soon", "trigger_type": "onServerEvent", "trigger_config": {"event": "calendar_event_upcoming"}},
                },
                {
                    "id": "action-1",
                    "type": "action",
                    "position": {"x": 250, "y": 150},
                    "data": {"label": "Send Reminder", "tool": "send_notification", "args": {"title": "⏰ Event Reminder", "message": "Your event starts in 15 minutes!", "severity": "warning"}},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger-1", "target": "action-1"},
            ],
        },
        "enabled": False,
    },
    {
        "name": "New Todo Alert",
        "description": "Sends a notification when a new todo item is added",
        "trigger_type": "onDataChange",
        "trigger_config": {
            "data_source": "todos",
            "change_type": "insert",
        },
        "graph": {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "trigger",
                    "position": {"x": 250, "y": 0},
                    "data": {"label": "Todo Added", "trigger_type": "onDataChange", "trigger_config": {"data_source": "todos"}},
                },
                {
                    "id": "condition-1",
                    "type": "condition",
                    "position": {"x": 250, "y": 150},
                    "data": {"label": "Check Priority", "condition": "{{trigger.data.priority}} == 'high'"}},
                {
                    "id": "action-1",
                    "type": "action",
                    "position": {"x": 100, "y": 300},
                    "data": {"label": "Notify User", "tool": "send_notification", "args": {"title": "📝 High Priority Task", "message": "New high-priority todo added", "severity": "warning"}},
                },
                {
                    "id": "action-2",
                    "type": "action",
                    "position": {"x": 400, "y": 300},
                    "data": {"label": "Log Activity", "tool": "send_notification", "args": {"title": "📋 Activity Log", "message": "Todo added to your list", "severity": "info"}},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger-1", "target": "condition-1"},
                {"id": "e2-3a", "source": "condition-1", "sourceHandle": "true", "target": "action-1"},
                {"id": "e2-3b", "source": "condition-1", "sourceHandle": "false", "target": "action-2"},
            ],
        },
        "enabled": False,
    },
]


async def seed_sample_workflows(db: AsyncSession) -> None:
    """Insert sample workflows for the first user if none exist."""
    count = (await db.execute(select(func.count()).select_from(Workflow))).scalar_one()
    if count > 0:
        logger.info(f"Workflow table already has {count} entries — skipping sample seed")
        return

    # Find the first user to associate workflows with
    user_result = await db.execute(select(User).order_by(User.created_at.asc()).limit(1))
    first_user = user_result.scalar_one_or_none()

    if not first_user:
        logger.info("No users found — skipping workflow seed (data will be empty until users create workflows)")
        return

    for data in SAMPLE_WORKFLOWS:
        db.add(Workflow(
            id=str(uuid.uuid4()),
            user_id=str(first_user.id),
            **data,
        ))

    await db.commit()
    logger.info(f"Seeded {len(SAMPLE_WORKFLOWS)} sample workflows for user {first_user.id}")
