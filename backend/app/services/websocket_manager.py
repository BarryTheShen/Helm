import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from loguru import logger


class ConnectionInfo:
    """Metadata for a single WebSocket connection."""

    __slots__ = ("device_id", "websocket", "connected_since")

    def __init__(self, device_id: str | None, websocket: WebSocket) -> None:
        self.device_id = device_id
        self.websocket = websocket
        self.connected_since: datetime = datetime.now(timezone.utc)


class ConnectionManager:
    """Manages active WebSocket connections keyed by user_id and device_id.

    Architecture Decision: Session 2, Section 10 — Device routing infrastructure.
    Connections are tracked per (user_id, device_id) so messages can be targeted
    to specific devices in the future. For now, send() broadcasts to all user
    connections, but send_to_device() enables targeted delivery.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[ConnectionInfo]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, device_id: str | None = None) -> None:
        await websocket.accept()
        info = ConnectionInfo(device_id, websocket)
        self._connections.setdefault(user_id, []).append(info)
        logger.info(f"WS connected: user={user_id} device={device_id} total={len(self._connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self._connections.get(user_id, [])
        self._connections[user_id] = [c for c in conns if c.websocket is not websocket]
        if not self._connections[user_id]:
            self._connections.pop(user_id, None)
        logger.info(f"WS disconnected: user={user_id}")

    async def send(self, user_id: str, message: dict[str, Any]) -> None:
        """Send a message to all connections for a user (all devices)."""
        dead: list[WebSocket] = []
        for conn in self._connections.get(user_id, []):
            try:
                await conn.websocket.send_json(message)
            except Exception:
                dead.append(conn.websocket)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def send_to_device(self, user_id: str, device_id: str, message: dict[str, Any]) -> None:
        """Send a message to a specific device for a user."""
        dead: list[WebSocket] = []
        for conn in self._connections.get(user_id, []):
            if conn.device_id == device_id:
                try:
                    await conn.websocket.send_json(message)
                except Exception:
                    dead.append(conn.websocket)
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
        return [c.device_id for c in self._connections.get(user_id, [])]

    def get_all_connections(self) -> list[tuple[str, ConnectionInfo]]:
        """Return all active (user_id, connection_info) pairs (for admin stats)."""
        result: list[tuple[str, ConnectionInfo]] = []
        for user_id, conns in self._connections.items():
            for conn in conns:
                result.append((user_id, conn))
        return result

    async def ping_all(self) -> None:
        """Send a server-initiated ping to all connections; prune any that fail."""
        for user_id in list(self._connections.keys()):
            dead: list[WebSocket] = []
            for conn in self._connections.get(user_id, []):
                try:
                    await conn.websocket.send_json({"type": "ping"})
                except Exception:
                    dead.append(conn.websocket)
            for ws in dead:
                self.disconnect(ws, user_id)
                logger.info(f"WS pruned stale connection: user={user_id}")


# Singleton shared across the app
manager = ConnectionManager()
