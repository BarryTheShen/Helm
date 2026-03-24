from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventsResponse,
    CalendarEventUpdate,
)

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events", response_model=CalendarEventsResponse)
async def list_events(
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(CalendarEvent).where(
        CalendarEvent.user_id == str(current_user.id)
    ).order_by(CalendarEvent.start_time)

    if start_date:
        from datetime import datetime
        query = query.where(CalendarEvent.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        from datetime import datetime
        query = query.where(CalendarEvent.end_time <= datetime.fromisoformat(end_date))

    result = await db.execute(query)
    events = result.scalars().all()
    return CalendarEventsResponse(
        events=[
            CalendarEventOut(
                id=str(e.id),
                title=e.title,
                start_time=e.start_time,
                end_time=e.end_time,
                description=e.description,
                color=e.color,
                location=e.location,
                all_day=e.is_all_day,
                created_at=e.created_at,
            )
            for e in events
        ]
    )


@router.post("/events", response_model=CalendarEventOut, status_code=201)
async def create_event(
    body: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = CalendarEvent(
        id=str(uuid4()),
        user_id=str(current_user.id),
        title=body.title,
        start_time=body.start_time,
        end_time=body.end_time,
        description=body.description,
        color=body.color,
        location=body.location,
        is_all_day=body.all_day,
    )
    db.add(event)
    await db.flush()
    return CalendarEventOut(
        id=str(event.id),
        title=event.title,
        start_time=event.start_time,
        end_time=event.end_time,
        description=event.description,
        color=event.color,
        location=event.location,
        all_day=event.is_all_day,
        created_at=event.created_at,
    )


@router.put("/events/{event_id}", response_model=CalendarEventOut)
async def update_event(
    event_id: str,
    body: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.user_id == str(current_user.id),
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    field_map = {"all_day": "is_all_day"}
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(event, field_map.get(field, field), value)
    await db.flush()
    return CalendarEventOut(
        id=str(event.id),
        title=event.title,
        start_time=event.start_time,
        end_time=event.end_time,
        description=event.description,
        color=event.color,
        location=event.location,
        all_day=event.is_all_day,
        created_at=event.created_at,
    )


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.user_id == str(current_user.id),
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    return {"message": "Event deleted"}
