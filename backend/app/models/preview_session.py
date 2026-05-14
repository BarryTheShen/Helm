"""PreviewSession — a time-limited preview of an app or module.

Preview sessions allow testing changes on a device or in the web admin
before publishing them as a permanent version.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PreviewSession(Base):
    __tablename__ = "preview_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # web_admin | mobile_device

    # Which app/module is being previewed
    app_id: Mapped[str | None] = mapped_column(
        ForeignKey("apps.id", ondelete="CASCADE"), nullable=True, index=True
    )
    module_id: Mapped[str | None] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Preview content (resolved at session creation time)
    resolved_config_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    resolved_sdui_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Device tracking
    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | expired | exited
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    device: Mapped["Device | None"] = relationship()  # type: ignore[name-defined]  # noqa: F821
