from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditOut(BaseModel):
    id: str
    user_id: str
    action_type: str
    resource_type: str
    resource_id: str | None = None
    details_json: dict | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
