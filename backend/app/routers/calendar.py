from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.calendar_event import CalendarEvent
from app.models.module_state import ModuleState
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventsResponse,
    CalendarEventUpdate,
)

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

_SDUI_CALENDAR_KEY = "sdui__calendar"


async def _update_sdui_calendar(db: AsyncSession, user_id: str) -> None:
    """After any event mutation, rebuild the calendar events in the SDUI screen and broadcast.

    This makes the Calendar tab in the mobile app auto-refresh whenever an event
    is added or deleted — no manual page reload needed.

    Only runs if the user already has a SDUI calendar screen set. If no screen
    exists yet, this is a no-op (the agent hasn't set up the tab yet).
    """
    from app.services.websocket_manager import manager

    # Load the current SDUI screen
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == _SDUI_CALENDAR_KEY,
        )
    )
    state = result.scalar_one_or_none()
    if state is None or not state.state_json:
        return  # no SDUI screen set, nothing to update

    # Fetch all calendar events for this user
    events_result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user_id)
        .order_by(CalendarEvent.start_time)
    )
    events = events_result.scalars().all()

    event_list = [
        {
            "id": str(e.id),
            "title": e.title,
            "start": e.start_time.isoformat() if e.start_time else "",
            "end": e.end_time.isoformat() if e.end_time else "",
            "color": e.color or "#6366f1",
        }
        for e in events
    ]

    # Deep-update: find every calendar component in the screen and refresh its events
    import copy
    screen = copy.deepcopy(state.state_json)

    def _update_components(components: list) -> list:
        for comp in components:
            if comp.get("type") == "calendar":
                # Update events in both flat and props-based formats
                comp["events"] = event_list
                if "props" in comp:
                    comp["props"]["events"] = event_list
            # Recurse into children
            if "children" in comp:
                comp["children"] = _update_components(comp["children"])
        return components

    for section in screen.get("sections", []):
        comps = section.get("components", [])
        if comps:
            section["components"] = _update_components(comps)
        # Also handle legacy singular "component" field
        if "component" in section and section["component"].get("type") == "calendar":
            section["component"]["events"] = event_list
            if "props" in section["component"]:
                section["component"]["props"]["events"] = event_list

    state.state_json = screen
    state.version += 1
    await db.commit()

    from app.mcp.tools import normalize_sdui_screen

    # Broadcast updated screen so the frontend re-renders immediately
    await manager.send(user_id, {
        "type": "sdui_screen_update",
        "module_id": "calendar",
        "screen": normalize_sdui_screen(screen),
        "version": state.version,
    })


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
    await db.commit()

    # Auto-refresh the SDUI calendar screen so the frontend updates live
    await _update_sdui_calendar(db, str(current_user.id))

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


@router.post("/add-meeting", status_code=201)
async def add_meeting(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """User-friendly meeting creation from an SDUI form.

    Accepts separate date and time fields, auto-combines into ISO datetimes.

    Request body fields:
      title       (str, required)   e.g. "Team Standup"
      date        (str, required)   e.g. "2026-04-01"
      start_time  (str, required)   e.g. "14:00" or "2:00 PM"
      end_time    (str, required)   e.g. "15:00" or "3:00 PM"
      description (str, optional)
      color       (str, optional)   hex color e.g. "#6366f1"
    """
    from datetime import datetime
    import re

    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="title is required")

    date_str = (body.get("date") or "").strip()
    start_str = (body.get("start_time") or "").strip()
    end_str = (body.get("end_time") or "").strip()

    def _parse_time(time_str: str) -> str:
        """Convert various time formats to HH:MM (24h)."""
        time_str = time_str.strip()
        # Already 24h format "14:00"
        if re.match(r'^\d{1,2}:\d{2}$', time_str):
            return time_str.zfill(5)
        # 12h format "2:00 PM" or "2:00PM"
        m = re.match(r'^(\d{1,2}):(\d{2})\s*(AM|PM)$', time_str, re.I)
        if m:
            h, mn, ampm = int(m.group(1)), m.group(2), m.group(3).upper()
            if ampm == "PM" and h != 12:
                h += 12
            elif ampm == "AM" and h == 12:
                h = 0
            return f"{h:02d}:{mn}"
        raise HTTPException(status_code=422, detail=f"Cannot parse time: '{time_str}'. Use format 14:00 or 2:00 PM")

    try:
        start_iso = f"{date_str}T{_parse_time(start_str)}:00"
        end_iso = f"{date_str}T{_parse_time(end_str)}:00"
        start_dt = datetime.fromisoformat(start_iso)
        end_dt = datetime.fromisoformat(end_iso)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid date/time: {exc}")

    event = CalendarEvent(
        id=str(uuid4()),
        user_id=str(current_user.id),
        title=title,
        start_time=start_dt,
        end_time=end_dt,
        description=body.get("description") or None,
        color=body.get("color") or "#6366f1",
        is_all_day=False,
    )
    db.add(event)
    await db.flush()
    await db.commit()

    # Auto-refresh the SDUI calendar screen
    await _update_sdui_calendar(db, str(current_user.id))

    return {
        "id": str(event.id),
        "title": event.title,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "message": f"Meeting '{title}' added successfully!",
    }


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
    await db.commit()
    await _update_sdui_calendar(db, str(current_user.id))
    return {"message": "Event deleted"}
