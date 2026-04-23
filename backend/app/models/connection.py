import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Connection(Base, TimestampMixin):
    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    module_instance_id: Mapped[str | None] = mapped_column(
        ForeignKey("module_instances.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    credentials_encrypted: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="connections")  # type: ignore[name-defined]  # noqa: F821
    module_instance: Mapped["ModuleInstance | None"] = relationship(back_populates="connections")  # type: ignore[name-defined]  # noqa: F821
