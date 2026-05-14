"""AppWorkingDraft — current working draft state for an app.

Tracks the in-progress app configuration including theme, bottom bar,
launchpad, and module references before publishing as a version.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AppWorkingDraft(Base):
    __tablename__ = "app_working_drafts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    app_id: Mapped[str] = mapped_column(
        ForeignKey("apps.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Full app config: theme, bottom_bar, launchpad, module_references
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    last_autosaved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    base_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    validation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unknown"
    )  # unknown | valid | invalid
    validation_errors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    dirty: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    app: Mapped["App"] = relationship(back_populates="working_draft")  # type: ignore[name-defined]  # noqa: F821
