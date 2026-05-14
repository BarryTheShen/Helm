"""ModuleWorkingDraft — current working draft state for a module.

Replaces the old __draft ModuleState-based draft system with a proper
model that tracks validation status, base version, and dirty state.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ModuleWorkingDraft(Base):
    __tablename__ = "module_working_drafts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    module_id: Mapped[str] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sdui_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
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

    module_instance: Mapped["ModuleInstance"] = relationship(back_populates="working_draft")  # type: ignore[name-defined]  # noqa: F821
