from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdminStatsOut(BaseModel):
    total_users: int
    active_sessions: int
    connected_ws_clients: int
    total_events: int
    total_workflows: int
    active_workflows: int
    total_notifications: int
    unread_notifications: int
    total_screens: int
    total_templates: int
    total_audit_entries: int


class WebSocketConnectionOut(BaseModel):
    user_id: str
    device_id: str | None = None
    connected_since: datetime


class WebSocketStatsOut(BaseModel):
    connected_users: list[WebSocketConnectionOut]


class WorkflowAnalyticsItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    is_active: bool
    run_count: int
    last_run_at: datetime | None
    audit_entries: int
