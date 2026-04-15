import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class DataSource(Base, TimestampMixin):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    connector: Mapped[str] = mapped_column(String(100), nullable=False)
    config_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    schema_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]  # noqa: F821
