from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class CalendarEvent(Base, TimestampMixin):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Field naming convention: model uses is_all_day, API schemas use all_day.
    # The mapping is handled in the router's field_map (see calendar.py update_event).
    is_all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # FF4-CAL-026: sourceType field — tracks event origin (local/caldav/notion/custom)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="local")

    # FF4-CAL-027: free-form notes/content field for event details
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="calendar_events")  # type: ignore[name-defined]  # noqa: F821
