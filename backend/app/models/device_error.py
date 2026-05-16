"""DeviceErrorReport — errors reported by devices or preview sessions.

Devices can report render errors, runtime crashes, and preview failures.
These are stored for admin/developer review.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DeviceErrorReport(Base):
    __tablename__ = "device_error_reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("devices.id", ondelete="SET NULL"), nullable=True, index=True
    )
    preview_session_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, index=True
    )

    # Error details
    error_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="render_error"
    )  # render_error | preview_failure | runtime_crash | other
    error_message: Mapped[str] = mapped_column(String(1000), nullable=False)
    error_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Source — how this error was reported
    source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="device"
    )  # device | preview_session

    # Admin review
    reviewed: Mapped[bool] = mapped_column(default=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    device: Mapped["Device | None"] = relationship()  # type: ignore[name-defined]  # noqa: F821
