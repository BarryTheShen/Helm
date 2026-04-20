import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TriggerDefinition(Base, TimestampMixin):
    __tablename__ = "trigger_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    module_instance_id: Mapped[str | None] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # schedule | data_change | server_event
    config_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    action_chain_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
    module_instance: Mapped["ModuleInstance | None"] = relationship(back_populates="trigger_definitions")  # type: ignore[name-defined]  # noqa: F821
