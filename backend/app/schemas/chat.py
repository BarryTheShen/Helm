from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    metadata: dict[str, Any] | None = None

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageOut]
    has_more: bool


class SendMessageRequest(BaseModel):
    content: str
    conversation_id: str | None = None
