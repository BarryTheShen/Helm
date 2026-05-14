"""AppVersion — a versioned snapshot of an app's configuration.

Versions are created from checkpoints of the AppWorkingDraft and represent
named, publishable states of an app. When published, the version becomes
the live app config pushed to assigned devices.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AppVersion(Base):
    __tablename__ = "app_versions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    app_id: Mapped[str] = mapped_column(
        ForeignKey("apps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Display identity
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_timestamp_name: Mapped[str] = mapped_column(String(255), nullable=False)
    custom_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Content — full resolved app config at publish time
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Module version references at publish time
    resolved_module_versions: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )
    # Module reference policies: [{module_id, policy, selected_version_id?}]
    module_reference_policies: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )

    # Metadata
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="publish"
    )  # manual | auto | publish | restore
    parent_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    change_summary: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Validation
    validation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unknown"
    )  # unknown | valid | invalid
    validation_errors: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Schema tracking
    schema_version: Mapped[str] = mapped_column(String(20), nullable=False, default="2.0")
    min_mobile_runtime_version: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    app: Mapped["App"] = relationship(back_populates="versions")  # type: ignore[name-defined]  # noqa: F821
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
