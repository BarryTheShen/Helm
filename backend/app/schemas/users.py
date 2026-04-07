from datetime import datetime

from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: str | None = None


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    created_at: datetime


class UserDetailOut(UserOut):
    device_count: int
    active_session_count: int
