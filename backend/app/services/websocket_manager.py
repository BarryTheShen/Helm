import asyncio
from typing import Any

from fastapi import WebSocket
from loguru import logger


class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id and device_id.

    Architecture Decision: Session 2, Section 10 — Device routing infrastructure.
    Connections are tracked per (user_id, device_id) so messages can be targeted
    to specific devices in the future. For now, send() broadcasts to all user
    connections, but send_to_device() enables targeted delivery.
    """

    def __init__(self) -> None:
        # user_id -> list of (device_id, websocket) tuples
        self._connections: dict[str, list[tuple[str | None, WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, device_id: str | None = None) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, []).append((device_id, websocket))
        logger.info(f"WS connected: user={user_id} device={device_id} total={len(self._connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self._connections.get(user_id, [])
        self._connections[user_id] = [(did, ws) for did, ws in conns if ws is not websocket]
        if not self._connections[user_id]:
            self._connections.pop(user_id, None)
        logger.info(f"WS disconnected: user={user_id}")

    async def send(self, user_id: str, message: dict[str, Any]) -> None:
        """Send a message to all connections for a user (all devices)."""
        dead: list[WebSocket] = []
        for device_id, ws in self._connections.get(user_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def send_to_device(self, user_id: str, device_id: str, message: dict[str, Any]) -> None:
        """Send a message to a specific device for a user."""
        dead: list[WebSocket] = []
        for did, ws in self._connections.get(user_id, []):
            if did == device_id:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

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


# Singleton shared across the app
manager = ConnectionManager()
