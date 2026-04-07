from datetime import datetime

from pydantic import BaseModel


class SessionOut(BaseModel):
    id: str
    user_id: str
    username: str | None = None
    device_name: str | None = None
    device_id: str | None = None
    is_active: bool
    created_at: datetime
    expires_at: str | None = None
