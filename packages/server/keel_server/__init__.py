"""Keel Server — FastAPI helpers for AI-driven Server-Driven UI apps.

Provides WebSocket connection management, MCP server helpers,
SDUI normalization, and an action registry base class.
"""

__version__ = "0.1.0"

from keel_server.websocket import ConnectionManager
from keel_server.mcp import create_mcp_server, MCPAuthMiddleware, get_current_user_id
from keel_server.tools import normalize_sdui_screen
from keel_server.registry import ActionRegistry

__all__ = [
    "ConnectionManager",
    "create_mcp_server",
    "MCPAuthMiddleware",
    "get_current_user_id",
    "normalize_sdui_screen",
    "ActionRegistry",
]
