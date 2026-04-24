"""AppModuleRef — junction table linking Apps to ModuleInstances.

This many-to-many relationship allows multiple apps to reference the same
ModuleInstance (e.g., one Calendar instance appears in both "Work" and
"Personal" apps). The junction table tracks ordering for bottom bar slots
and launchpad position.
"""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AppModuleRef(Base, TimestampMixin):
    __tablename__ = "app_module_refs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    app_id: Mapped[str] = mapped_column(
        ForeignKey("apps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module_instance_id: Mapped[str] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 0-4 for bottom bar slots, null for launchpad
    slot_position: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Relationships ───────────────────────────────────────────────────────
    app: Mapped["App"] = relationship(back_populates="module_refs")  # type: ignore[name-defined]  # noqa: F821
    module_instance: Mapped["ModuleInstance"] = relationship()  # type: ignore[name-defined]  # noqa: F821
