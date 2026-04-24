"""ModuleInstance — one installed module per user per module_type.

This is the keystone entity for the mini-app platform. Every workflow,
trigger, connection, data source, notification, module state, and screen
history row can be scoped to exactly one ModuleInstance. When a module is
uninstalled, the cascade removes all its data in one operation.

For the v1 migration, existing rows are assigned to a synthetic "legacy"
instance per user so that existing data is never lost.
"""

import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ModuleInstance(Base, TimestampMixin):
    __tablename__ = "module_instances"
    __table_args__ = (
        # A user has exactly one active instance per module_type in v1.
        # Phase 4c (multi-install) will revisit this constraint.
        UniqueConstraint("user_id", "module_type", name="uq_module_instances_user_type"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[str | None] = mapped_column(
        ForeignKey("sdui_templates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Slug that identifies the module type, e.g. "calendar", "todo", "legacy"
    module_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # User-facing display name
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Semver string; "0.0.0" for legacy rows created by the backfill migration
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="0.0.0")
    # JSON snapshot of the template manifest at install time; nullable until Phase 4b
    manifest_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Lifecycle status
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | disabled | uninstalled

    # ── Relationships ───────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="module_instances")  # type: ignore[name-defined]  # noqa: F821
    template: Mapped["SDUITemplate | None"] = relationship()  # type: ignore[name-defined]  # noqa: F821

    # Reverse relationships — cascade="all, delete-orphan" ensures that
    # deleting a ModuleInstance removes all scoped data atomically.
    app_refs: Mapped[list["AppModuleRef"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    workflows: Mapped[list["Workflow"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    trigger_definitions: Mapped[list["TriggerDefinition"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    connections: Mapped[list["Connection"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    data_sources: Mapped[list["DataSource"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    module_states: Mapped[list["ModuleState"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
    screen_histories: Mapped[list["ScreenHistory"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="module_instance", cascade="all, delete-orphan"
    )
