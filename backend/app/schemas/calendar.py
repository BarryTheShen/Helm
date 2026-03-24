from datetime import datetime
from typing import Any

from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    description: str | None = None
    color: str | None = None
    location: str | None = None
    all_day: bool = False


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    description: str | None = None
    color: str | None = None
    location: str | None = None
    all_day: bool | None = None


class CalendarEventOut(BaseModel):
    id: str
    title: str
    start_time: datetime
    end_time: datetime
    description: str | None
    color: str | None
    location: str | None
    all_day: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEventOut]
