from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    category: str
    screen_json: dict
    is_public: bool = False


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    screen_json: dict | None = None
    is_public: bool | None = None


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    category: str
    is_public: bool
    created_by: str
    created_at: datetime
    updated_at: datetime | None = None


class TemplateDetailOut(TemplateOut):
    screen_json: dict


class ApplyTemplateRequest(BaseModel):
    module_id: str
