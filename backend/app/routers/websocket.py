import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.services.auth import get_session_by_token
from app.services.websocket_manager import manager

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str | None) -> str | None:
    """Validate WS token and return user_id, or None if invalid."""
    if not token:
        return None
    async with AsyncSessionLocal() as db:
        session = await get_session_by_token(db, token)
        if session is None:
            return None
        return str(session.user_id)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    user_id = await _authenticate_ws(token)

    if user_id is None:
        await websocket.accept()
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id)
    await manager.send(user_id, {"type": "connected", "user_id": user_id})

    try:
        while True:
            data = await websocket.receive_json()
            await _handle_message(websocket, user_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as exc:
        logger.exception(f"WS error for user={user_id}: {exc}")
        manager.disconnect(websocket, user_id)


async def _handle_message(websocket: WebSocket, user_id: str, data: dict[str, Any]) -> None:
    msg_type = data.get("type", "")

    if msg_type == "ping":
        await websocket.send_json({"type": "pong"})
        return

    if msg_type == "chat_message":
        content = data.get("content", "")
        if not content:
            await websocket.send_json({"type": "error", "message": "Empty message"})
            return
        # Dispatch to agent proxy
        from app.services.agent_proxy import handle_chat_message
        asyncio.create_task(
            handle_chat_message(
                user_id=user_id,
                content=content,
                conversation_id=data.get("conversation_id"),
            )
        )
        return

    if msg_type == "module_action":
        await websocket.send_json({"type": "ack", "ref": data.get("ref")})
        return

    logger.warning(f"Unknown WS message type '{msg_type}' from user={user_id}")
    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})
