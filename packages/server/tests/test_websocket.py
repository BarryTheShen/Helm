"""Tests for keel_server.websocket.ConnectionManager."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from keel_server.websocket import ConnectionManager


def _make_ws() -> AsyncMock:
    """Create a mock WebSocket with accept() and send_json()."""
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


@pytest.fixture
def manager() -> ConnectionManager:
    return ConnectionManager()


# ── connect / disconnect ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connect_accepts_websocket(manager: ConnectionManager):
    ws = _make_ws()
    await manager.connect(ws, "user-1", "device-a")
    ws.accept.assert_awaited_once()


@pytest.mark.asyncio
async def test_connect_tracks_user(manager: ConnectionManager):
    ws = _make_ws()
    await manager.connect(ws, "user-1")
    assert manager.is_connected("user-1")
    assert "user-1" in manager.connected_user_ids


@pytest.mark.asyncio
async def test_disconnect_removes_user(manager: ConnectionManager):
    ws = _make_ws()
    await manager.connect(ws, "user-1")
    await manager.disconnect(ws, "user-1")
    assert not manager.is_connected("user-1")


@pytest.mark.asyncio
async def test_disconnect_only_target_socket(manager: ConnectionManager):
    ws1 = _make_ws()
    ws2 = _make_ws()
    await manager.connect(ws1, "user-1", "d1")
    await manager.connect(ws2, "user-1", "d2")
    await manager.disconnect(ws1, "user-1")
    assert manager.is_connected("user-1")
    assert manager.get_device_ids("user-1") == ["d2"]


@pytest.mark.asyncio
async def test_connect_multiple_devices(manager: ConnectionManager):
    ws1, ws2 = _make_ws(), _make_ws()
    await manager.connect(ws1, "user-1", "phone")
    await manager.connect(ws2, "user-1", "tablet")
    assert manager.get_device_ids("user-1") == ["phone", "tablet"]


# ── send ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_to_user(manager: ConnectionManager):
    ws = _make_ws()
    await manager.connect(ws, "user-1")
    await manager.send("user-1", {"type": "ping"})
    ws.send_json.assert_awaited_once_with({"type": "ping"})


@pytest.mark.asyncio
async def test_send_to_all_devices(manager: ConnectionManager):
    ws1, ws2 = _make_ws(), _make_ws()
    await manager.connect(ws1, "user-1", "d1")
    await manager.connect(ws2, "user-1", "d2")
    await manager.send("user-1", {"type": "update"})
    assert ws1.send_json.await_count == 1
    assert ws2.send_json.await_count == 1


@pytest.mark.asyncio
async def test_send_to_nonexistent_user(manager: ConnectionManager):
    # Should not raise
    await manager.send("nobody", {"type": "ping"})


@pytest.mark.asyncio
async def test_send_removes_dead_socket(manager: ConnectionManager):
    ws = _make_ws()
    ws.send_json.side_effect = Exception("broken pipe")
    await manager.connect(ws, "user-1")
    await manager.send("user-1", {"type": "ping"})
    assert not manager.is_connected("user-1")


# ── send_to_device ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_to_specific_device(manager: ConnectionManager):
    ws1, ws2 = _make_ws(), _make_ws()
    await manager.connect(ws1, "user-1", "phone")
    await manager.connect(ws2, "user-1", "tablet")
    await manager.send_to_device("user-1", "tablet", {"type": "alert"})
    ws1.send_json.assert_not_awaited()
    ws2.send_json.assert_awaited_once_with({"type": "alert"})


# ── broadcast ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_broadcast_to_all_users(manager: ConnectionManager):
    ws1, ws2 = _make_ws(), _make_ws()
    await manager.connect(ws1, "user-1")
    await manager.connect(ws2, "user-2")
    await manager.broadcast({"type": "announcement"})
    ws1.send_json.assert_awaited_once()
    ws2.send_json.assert_awaited_once()


# ── connected_user_ids ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_connected_user_ids_empty(manager: ConnectionManager):
    assert manager.connected_user_ids == []


@pytest.mark.asyncio
async def test_connected_user_ids_multiple(manager: ConnectionManager):
    await manager.connect(_make_ws(), "alice")
    await manager.connect(_make_ws(), "bob")
    assert sorted(manager.connected_user_ids) == ["alice", "bob"]


# ── concurrency ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_concurrent_connect_disconnect(manager: ConnectionManager):
    """Multiple concurrent connect/disconnect operations should not corrupt state."""
    sockets = [_make_ws() for _ in range(10)]
    # Connect all concurrently
    await asyncio.gather(*(manager.connect(ws, f"user-{i}") for i, ws in enumerate(sockets)))
    assert len(manager.connected_user_ids) == 10
    # Disconnect all concurrently
    await asyncio.gather(*(manager.disconnect(ws, f"user-{i}") for i, ws in enumerate(sockets)))
    assert len(manager.connected_user_ids) == 0
