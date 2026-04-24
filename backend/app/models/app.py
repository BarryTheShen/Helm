"""App — user-defined application configuration.

An App is a collection of ModuleInstances with custom theming, bottom bar
configuration, and launchpad layout. Users can create multiple apps and
assign them to different devices.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class App(Base, TimestampMixin):
    __tablename__ = "apps"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(255), nullable=True)
    splash: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    design_tokens: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    dark_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_launch_module_id: Mapped[str | None] = mapped_column(
        ForeignKey("module_instances.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # JSON array of {module_instance_id, slot_position} objects, max 5 items
    bottom_bar_config: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # JSON array of module_instance_id strings for launchpad
    launchpad_config: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # ── Relationships ───────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="apps")  # type: ignore[name-defined]  # noqa: F821
    default_launch_module: Mapped["ModuleInstance | None"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    module_refs: Mapped[list["AppModuleRef"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        back_populates="app", cascade="all, delete-orphan"
    )
    devices: Mapped[list["Device"]] = relationship(back_populates="app")  # type: ignore[name-defined]  # noqa: F821
