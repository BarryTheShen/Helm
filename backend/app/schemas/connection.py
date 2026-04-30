from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class ConnectionCreate(BaseModel):
    """Schema for creating a new connection.

    Credentials are optional because some providers (e.g. local data sources)
    do not require API keys.  However, if a credentials dict is supplied it
    must contain at least one key — passing ``{}`` is rejected as likely a
    configuration error.
    """

    name: str
    provider: str
    credentials: dict | None = None

    @field_validator("credentials", mode="before")
    @classmethod
    def validate_credentials(cls, v: dict | None) -> dict | None:
        """Reject explicitly empty dicts; allow None or dicts with keys."""
        if v is not None and len(v) == 0:
            raise ValueError("credentials must not be empty — provide at least one key or omit the field")
        return v


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
