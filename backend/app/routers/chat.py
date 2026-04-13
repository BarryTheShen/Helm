from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatHistoryResponse, ChatMessageOut, SendMessageRequest

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    limit: int = 20,
    offset: int = 0,
    conversation_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ChatMessage).where(ChatMessage.user_id == str(current_user.id))

    if conversation_id:
        query = query.where(ChatMessage.conversation_id == conversation_id)

    result = await db.execute(
        query.order_by(ChatMessage.created_at.desc())
        .limit(limit + 1)
        .offset(offset)
    )
    messages = result.scalars().all()
    has_more = len(messages) > limit
    return ChatHistoryResponse(
        messages=[
            ChatMessageOut(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at,
                metadata=m.metadata_json,
            )
            for m in messages[:limit]
        ],
        has_more=has_more,
    )


@router.delete("/history")
async def clear_chat_history(
    conversation_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = delete(ChatMessage).where(ChatMessage.user_id == str(current_user.id))
    if conversation_id:
        query = query.where(ChatMessage.conversation_id == conversation_id)
    await db.execute(query)
    await db.commit()
    return {"message": "Chat history cleared"}
