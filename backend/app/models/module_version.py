"""ModuleVersion — a versioned snapshot of a module's SDUI screen.

Versions are created from checkpoints and represent named, publishable states
of a module. The ScreenHistory model is deprecated in favor of this table.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ModuleVersion(Base):
    __tablename__ = "module_versions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    module_id: Mapped[str] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=False, index=True
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
    sdui_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Metadata
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="checkpoint"
    )  # checkpoint | publish | restore | import | api
    parent_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    change_summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Validation
    validation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unknown"
    )  # unknown | valid | invalid
    validation_errors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Schema tracking
    schema_version: Mapped[str] = mapped_column(String(20), nullable=False, default="2.0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    module_instance: Mapped["ModuleInstance"] = relationship(back_populates="versions")  # type: ignore[name-defined]  # noqa: F821
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
