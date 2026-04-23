import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Workflow(Base, TimestampMixin):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    module_instance_id: Mapped[str | None] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    graph: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # onSchedule | onDataChange | onServerEvent | manual
    trigger_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped["User"] = relationship(back_populates="workflows")  # type: ignore[name-defined]  # noqa: F821
    module_instance: Mapped["ModuleInstance | None"] = relationship(back_populates="workflows")  # type: ignore[name-defined]  # noqa: F821
