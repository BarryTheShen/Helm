import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TriggerType(str, enum.Enum):
    EVENT_CREATED = "event_created"
    EVENT_UPDATED = "event_updated"
    FORM_SUBMITTED = "form_submitted"
    SCHEDULE = "schedule"
    MESSAGE_RECEIVED = "message_received"
    DATA_CHANGED = "data_changed"
    SERVER_EVENT = "server_event"


class Workflow(Base, TimestampMixin):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[TriggerType] = mapped_column(
        Enum(TriggerType, name="trigger_type"),
        nullable=False,
    )
    trigger_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    action_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="workflows")  # type: ignore[name-defined]  # noqa: F821
