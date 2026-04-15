"""Data Connectors — canonical schema definitions and query logic for data sources.

Each connector type (calendar, notes, chat) has a canonical schema and a query
function that reads from the existing backend tables and normalizes the data.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── Canonical Schemas ──────────────────────────────────────────────────────

CANONICAL_SCHEMAS: dict[str, dict[str, Any]] = {
    "calendar": {
        "type": "calendar",
        "fields": [
            {"name": "id", "type": "string"},
            {"name": "title", "type": "string"},
            {"name": "start_time", "type": "datetime"},
            {"name": "end_time", "type": "datetime"},
            {"name": "location", "type": "string", "nullable": True},
            {"name": "description", "type": "string", "nullable": True},
        ],
    },
    "notes": {
        "type": "notes",
        "fields": [
            {"name": "id", "type": "string"},
            {"name": "module_type", "type": "string"},
            {"name": "content", "type": "object"},
            {"name": "version", "type": "integer"},
        ],
    },
    "chat": {
        "type": "chat",
        "fields": [
            {"name": "id", "type": "string"},
            {"name": "role", "type": "string"},
            {"name": "content", "type": "string"},
            {"name": "created_at", "type": "datetime"},
        ],
    },
}


def get_canonical_schema(source_type: str) -> dict[str, Any] | None:
    return CANONICAL_SCHEMAS.get(source_type)


async def query_data_source(
    source_type: str,
    user_id: str,
    db: AsyncSession,
    filters: dict[str, Any] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Query data from an existing backend table and normalize to canonical form."""

    if source_type == "calendar":
        return await _query_calendar(user_id, db, filters, limit, offset)
    elif source_type == "notes":
        return await _query_notes(user_id, db, filters, limit, offset)
    elif source_type == "chat":
        return await _query_chat(user_id, db, filters, limit, offset)
    else:
        return []


async def _query_calendar(
    user_id: str,
    db: AsyncSession,
    filters: dict[str, Any] | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    from app.models.calendar_event import CalendarEvent

    query = (
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id)
        .order_by(CalendarEvent.start_time)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    events = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "title": e.title,
            "start_time": e.start_time.isoformat() if e.start_time else None,
            "end_time": e.end_time.isoformat() if e.end_time else None,
            "location": e.location,
            "description": e.description,
        }
        for e in events
    ]


async def _query_notes(
    user_id: str,
    db: AsyncSession,
    filters: dict[str, Any] | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    from app.models.module_state import ModuleState

    query = (
        select(ModuleState)
        .where(ModuleState.user_id == user_id)
        .order_by(ModuleState.created_at)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    states = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "module_type": s.module_type,
            "content": s.state_json,
            "version": s.version,
        }
        for s in states
    ]


async def _query_chat(
    user_id: str,
    db: AsyncSession,
    filters: dict[str, Any] | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    from app.models.chat_message import ChatMessage

    query = (
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    messages = result.scalars().all()

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
