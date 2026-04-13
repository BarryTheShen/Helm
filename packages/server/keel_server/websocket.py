"""WebSocket connection manager for multi-device user sessions.

Manages active WebSocket connections keyed by user_id and device_id so messages
can be targeted to specific devices or broadcast to all connections for a user.
No singleton is created here — the consuming app creates its own instance.
"""

import asyncio
from typing import Any

from fastapi import WebSocket
from loguru import logger


class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id and device_id.

    Connections are tracked per (user_id, device_id) so messages can be targeted
    to specific devices. send() broadcasts to all connections for a user while
    send_to_device() enables targeted delivery.

    All mutations to _connections are guarded by an asyncio.Lock to prevent
    races under concurrent connect/disconnect/send operations.
    """

    def __init__(self) -> None:
        # user_id -> list of (device_id, websocket) tuples
        self._connections: dict[str, list[tuple[str | None, WebSocket]]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str, device_id: str | None = None) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, []).append((device_id, websocket))
            count = len(self._connections[user_id])
        logger.info(f"WS connected: user={user_id} device={device_id} total={count}")

    async def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            conns = self._connections.get(user_id, [])
            self._connections[user_id] = [(did, ws) for did, ws in conns if ws is not websocket]
            if not self._connections[user_id]:
                self._connections.pop(user_id, None)
        logger.info(f"WS disconnected: user={user_id}")

    async def send(self, user_id: str, message: dict[str, Any]) -> None:
        """Send a message to all connections for a user (all devices)."""
        async with self._lock:
            targets = list(self._connections.get(user_id, []))
        dead: list[WebSocket] = []
        for device_id, ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                logger.warning(f"WS send failed: user={user_id} device={device_id}")
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws, user_id)

    async def send_to_device(self, user_id: str, device_id: str, message: dict[str, Any]) -> None:
        """Send a message to a specific device for a user."""
        async with self._lock:
            targets = list(self._connections.get(user_id, []))
        dead: list[WebSocket] = []
        for did, ws in targets:
            if did == device_id:
                try:
                    await ws.send_json(message)
                except Exception:
                    logger.warning(f"WS send failed: user={user_id} device={did}")
                    dead.append(ws)
        for ws in dead:
            await self.disconnect(ws, user_id)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a message to all connected users."""
        for user_id in list(self._connections.keys()):
            await self.send(user_id, message)

    def is_connected(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    @property
    def connected_user_ids(self) -> list[str]:
        return list(self._connections.keys())

    def get_device_ids(self, user_id: str) -> list[str | None]:
        """Return list of device IDs connected for a user."""
        return [did for did, _ in self._connections.get(user_id, [])]
