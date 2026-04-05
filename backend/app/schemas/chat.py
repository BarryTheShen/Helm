from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    created_at: datetime
    metadata: dict[str, Any] | None = None


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageOut]
    has_more: bool


class SendMessageRequest(BaseModel):
    content: str
    conversation_id: str | None = None
