from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


# FF4-CAL-026: Valid source types for calendar events
VALID_SOURCE_TYPES = {"local", "caldav", "notion", "custom"}


class CalendarEventCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    description: str | None = None
    color: str | None = None
    location: str | None = None
    all_day: bool = False
    # FF4-CAL-026: sourceType field — defaults to 'local'
    source_type: str = "local"
    # FF4-CAL-027: free-form notes field
    notes: str | None = None

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        if v not in VALID_SOURCE_TYPES:
            raise ValueError(
                f"Invalid source_type '{v}'. Must be one of: {', '.join(sorted(VALID_SOURCE_TYPES))}"
            )
        return v


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    description: str | None = None
    color: str | None = None
    location: str | None = None
    all_day: bool | None = None
    # FF4-CAL-026: sourceType field (optional on update)
    source_type: str | None = None
    # FF4-CAL-027: free-form notes field (optional on update)
    notes: str | None = None

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SOURCE_TYPES:
            raise ValueError(
                f"Invalid source_type '{v}'. Must be one of: {', '.join(sorted(VALID_SOURCE_TYPES))}"
            )
        return v


class CalendarEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    start_time: datetime
    end_time: datetime
    description: str | None
    color: str | None
    location: str | None
    all_day: bool
    source_type: str = "local"
    notes: str | None = None
    created_at: datetime


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEventOut]
