"""TemplateVersion — a versioned snapshot of a template's screen JSON.

Templates can be versioned independently from modules, allowing users to
track changes to reusable UI templates over time.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    template_id: Mapped[str] = mapped_column(
        ForeignKey("sdui_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Display identity
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_timestamp_name: Mapped[str] = mapped_column(String(255), nullable=False)
    custom_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Content
    template_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Metadata
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="manual"
    )  # manual | auto | publish | restore
    parent_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    change_summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Validation
    validation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unknown"
    )  # unknown | valid | invalid
    validation_errors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    template: Mapped["SDUITemplate"] = relationship(back_populates="versions")  # type: ignore[name-defined]  # noqa: F821
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
