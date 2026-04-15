from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class DataSourceCreate(BaseModel):
    name: str
    type: str
    connector: str
    config_json: str = "{}"


class DataSourceUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    connector: str | None = None
    config_json: str | None = None


class DataSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    name: str
    type: str
    connector: str
    config_json: str
    schema_json: str | None  # noqa: F811 — intentional, matches DB column
    created_at: datetime
    updated_at: datetime


class DataSourceQueryParams(BaseModel):
    filters: dict[str, Any] | None = None
    limit: int = 50
    offset: int = 0
