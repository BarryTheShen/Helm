"""Calendar event seeding — creates sample events for demo/empty calendars.

Called lazily from the list_events endpoint when the user has no events yet.
Provides realistic sample data for the current month so the Calendar component
is immediately usable.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _sample_events_for_month(year: int, month: int) -> list[dict]:
    """Generate sample calendar events spread across the given month."""
    import calendar as cal_mod
    _, days_in_month = cal_mod.monthrange(year, month)
    events: list[dict] = []

    # Helper to create a datetime in the local month
    def dt(day: int, hour: int = 9, minute: int = 0) -> datetime:
        return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)

    # --- Week 1 events ---
    events.extend([
        {
            "title": "Team Standup",
            "start_time": dt(2, 9, 0),
            "end_time": dt(2, 9, 30),
            "description": "Daily standup meeting with the engineering team.",
            "color": "#6366f1",
            "location": "Virtual / Discord",
            "is_all_day": False,
        },
        {
            "title": "Design Review",
            "start_time": dt(4, 14, 0),
            "end_time": dt(4, 15, 30),
            "description": "Review new mockups for the dashboard redesign.",
            "color": "#ec4899",
            "location": "Figma",
            "is_all_day": False,
        },
        {
            "title": "Project Planning Session",
            "start_time": dt(6, 10, 0),
            "end_time": dt(6, 12, 0),
            "description": "Q2 planning — review OKRs, assign owners.",
            "color": "#f59e0b",
            "location": "Meeting Room A",
            "is_all_day": False,
        },
    ])

    # --- Week 2 events ---
    events.extend([
        {
            "title": "1:1 with Manager",
            "start_time": dt(9, 11, 0),
            "end_time": dt(9, 11, 30),
            "description": "Weekly 1:1 — career growth, blockers, feedback.",
            "color": "#10b981",
            "location": "Office 3rd Floor",
            "is_all_day": False,
        },
        {
            "title": "Lunch & Learn",
            "start_time": dt(11, 12, 0),
            "end_time": dt(11, 13, 0),
            "description": "Team lunch — talk about AI-assisted development.",
            "color": "#6366f1",
            "location": "Cafeteria",
            "is_all_day": False,
        },
        {
            "title": "Sprint Retrospective",
            "start_time": dt(13, 15, 0),
            "end_time": dt(13, 16, 0),
            "description": "What went well, what to improve, action items.",
            "color": "#8b5cf6",
            "location": "Meeting Room B",
            "is_all_day": False,
        },
    ])

    # --- Week 3 events ---
    events.extend([
        {
            "title": "Client Demo",
            "start_time": dt(16, 10, 0),
            "end_time": dt(16, 11, 0),
            "description": "Show latest features to the stakeholders.",
            "color": "#ef4444",
            "location": "Virtual / Zoom",
            "is_all_day": False,
        },
        {
            "title": "Code Review Session",
            "start_time": dt(18, 14, 0),
            "end_time": dt(18, 16, 0),
            "description": "Group code review — PRs for the new API module.",
            "color": "#3b82f6",
            "location": "War Room",
            "is_all_day": False,
        },
        {
            "title": "Team Outing",
            "start_time": dt(20, 11, 0),
            "end_time": dt(20, 17, 0),
            "description": "Quarterly team building activity.",
            "color": "#f59e0b",
            "is_all_day": True,
        },
    ])

    # --- Week 4 events ---
    events.extend([
        {
            "title": "Doctor Appointment",
            "start_time": dt(23, 9, 30),
            "end_time": dt(23, 10, 30),
            "description": "Annual checkup.",
            "color": "#ec4899",
            "location": "City Medical Center",
            "is_all_day": False,
        },
        {
            "title": "Release Planning",
            "start_time": dt(25, 10, 0),
            "end_time": dt(25, 12, 0),
            "description": "Plan the v2.1 release — scope, timeline, risks.",
            "color": "#6366f1",
            "location": "Meeting Room A",
            "is_all_day": False,
        },
        {
            "title": "End of Month Review",
            "start_time": dt(28, 14, 0),
            "end_time": dt(28, 15, 0),
            "description": "Monthly performance review — metrics, wins, learnings.",
            "color": "#8b5cf6",
            "location": "CEO Office",
            "is_all_day": False,
        },
        {
            "title": "Conference Talk Prep",
            "start_time": dt(30, 10, 0),
            "end_time": dt(30, 12, 0),
            "description": "Prepare slides for the upcoming tech conference talk.",
            "color": "#10b981",
            "is_all_day": False,
        },
    ])

    # Clamp events to valid days of the month
    clamped: list[dict] = []
    for ev in events:
        if ev["start_time"].day <= days_in_month and ev["end_time"].day <= days_in_month:
            clamped.append(ev)

    return clamped


async def seed_calendar_events_for_user(
    user_id: str,
    db: AsyncSession,
    *,
    force: bool = False,
) -> list[str]:
    """Seed sample calendar events for a user if they have none.

    Returns a list of created event IDs (empty if already had events).
    If *force* is True, seeds events regardless of existing count.
    """
    # Check existing count
    from app.models.calendar_event import CalendarEvent
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.user_id == user_id).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing is not None and not force:
        logger.debug("User %s already has calendar events — skipping seed", user_id)
        return []

    now = datetime.now(timezone.utc)
    sample_events = _sample_events_for_month(now.year, now.month)

    created_ids: list[str] = []
    for ev_data in sample_events:
        event = CalendarEvent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=ev_data["title"],
            start_time=ev_data["start_time"],
            end_time=ev_data["end_time"],
            description=ev_data.get("description"),
            color=ev_data.get("color", "#6366f1"),
            location=ev_data.get("location"),
            is_all_day=ev_data.get("is_all_day", False),
        )
        db.add(event)
        created_ids.append(str(event.id))

    await db.commit()
    if created_ids:
        logger.info("Seeded %d calendar events for user %s", len(created_ids), user_id)
    return created_ids
