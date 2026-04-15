from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CustomVariableCreate(BaseModel):
    name: str
    value: str
    type: Literal["text", "number", "boolean"] = "text"
    description: str | None = None


class CustomVariableUpdate(BaseModel):
    name: str | None = None
    value: str | None = None
    type: Literal["text", "number", "boolean"] | None = None
    description: str | None = None


class CustomVariableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    value: str
    type: str
    description: str | None
    created_at: datetime
    updated_at: datetime
