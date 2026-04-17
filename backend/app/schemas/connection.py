from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConnectionCreate(BaseModel):
    name: str
    provider: str
    credentials: dict


class ConnectionUpdate(BaseModel):
    name: str | None = None
    credentials: dict | None = None


class ConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    provider: str
    created_at: datetime
    updated_at: datetime


class ConnectionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    provider: str
    credentials: dict
    created_at: datetime
    updated_at: datetime
