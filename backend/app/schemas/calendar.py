from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


# FF4-CAL-026: Valid source types for calendar events
VALID_SOURCE_TYPES = {"local", "caldav", "notion", "custom"}

# Field naming convention:
#   Model (SQLAlchemy) → is_all_day
#   API schema (Pydantic) → all_day
#   Mapping: router uses field_map = {"all_day": "is_all_day"} in update_event


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


class MeetingCreate(BaseModel):
    """Schema for the /api/calendar/add-meeting endpoint.

    Accepts separate date and time strings as submitted by the SDUI form;
    the endpoint combines them into full datetime objects.

    Fields:
      title      (str, required)   e.g. "Team Standup"
      date       (str, required)   e.g. "2026-04-01"
      start_time (str, required)   e.g. "14:00" or "2:00 PM"
      end_time   (str, required)   e.g. "15:00" or "3:00 PM"
      description (str, optional)
      color      (str, optional)   hex color e.g. "#6366f1"
      source_type (str, optional)  defaults to "local"
      notes      (str, optional)
    """

    title: str
    date: str
    start_time: str
    end_time: str
    description: str | None = None
    color: str | None = None
    source_type: str = "local"
    notes: str | None = None

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        if v not in VALID_SOURCE_TYPES:
            raise ValueError(
                f"Invalid source_type '{v}'. Must be one of: {', '.join(sorted(VALID_SOURCE_TYPES))}"
            )
        return v
