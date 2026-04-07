from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    message: str
    severity: str
    is_read: bool
    actions: list[dict[str, Any]] | None
    created_at: datetime


class NotificationsResponse(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
    total: int
    limit: int
    offset: int
    has_more: bool
