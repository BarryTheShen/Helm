import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.services.auth import get_session_by_token
from app.services.websocket_manager import manager

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(token: str | None) -> tuple[str | None, str | None]:
    """Validate WS token and return (user_id, device_id), or (None, None) if invalid."""
    if not token:
        return None, None
    async with AsyncSessionLocal() as db:
        session = await get_session_by_token(db, token)
        if session is None:
            return None, None
        return str(session.user_id), session.device_id


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    device_id_param = websocket.query_params.get("device_id")
    user_id, session_device_id = await _authenticate_ws(token)
    # Use explicit device_id param if provided, else fall back to session's device
    device_id = device_id_param or session_device_id

    if user_id is None:
        await websocket.accept()
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket, user_id, device_id)
    await manager.send(user_id, {"type": "connected", "user_id": user_id, "device_id": device_id})

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
        # Execute named function via the action registry
        from app.services.action_registry import registry
        func_name = data.get("function", "")
        params = data.get("params", {})
        ref = data.get("ref")
        if not func_name or not registry.is_registered(func_name):
            await websocket.send_json({"type": "error", "message": f"Unknown action: {func_name}", "ref": ref})
            return
        try:
            async with AsyncSessionLocal() as db:
                result = await registry.execute(func_name, user_id, params, db)
                await websocket.send_json({"type": "action_result", "ref": ref, "result": result})
        except Exception as exc:
            logger.exception(f"Action '{func_name}' failed for user={user_id}: {exc}")
            await websocket.send_json({"type": "action_error", "ref": ref, "message": str(exc)})
        return

    logger.warning(f"Unknown WS message type '{msg_type}' from user={user_id}")
    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})
