from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScreenHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version: int
    source: str
    is_starred: bool
    user_id: str
    created_at: datetime


class ScreenHistoryDetailOut(ScreenHistoryOut):
    screen_json: dict
