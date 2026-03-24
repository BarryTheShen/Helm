from datetime import datetime
from typing import Any

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    severity: str
    is_read: bool
    actions: list[dict[str, Any]] | None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationsResponse(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
