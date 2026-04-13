"""MCP server factory with pluggable Bearer token authentication.

Provides a factory function for creating an MCP server with ASGI auth middleware.
The token validation logic is injected by the caller, keeping this module free of
any app-specific database or session dependencies.
"""

import contextvars
import json
from typing import Awaitable, Callable

from loguru import logger
from mcp.server.fastmcp import FastMCP


# MCP context var for user_id — set per-request by MCPAuthMiddleware
_current_user_id: contextvars.ContextVar[str] = contextvars.ContextVar("_current_user_id", default="")


def get_current_user_id() -> str:
    """Return the user_id stamped into the current request context by MCPAuthMiddleware."""
    return _current_user_id.get()


class MCPAuthMiddleware:
    """ASGI middleware that validates Bearer session tokens before forwarding to MCP.

    FastAPI Depends() does not apply to mounted ASGI sub-apps, so auth must be
    handled at the ASGI level. A valid token is required on every request; the
    resolved user_id is stored in _current_user_id so MCP tool handlers can
    retrieve it via get_current_user_id() without extra round-trips.

    Args:
        app: The inner ASGI application to wrap.
        validate_token: Async callable that accepts a token string and returns
            the user_id string if valid, or None if invalid/expired.
    """

    def __init__(
        self,
        app,
        validate_token: Callable[[str], Awaitable[str | None]],
    ) -> None:
        self._app = app
        self._validate_token = validate_token

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self._app(scope, receive, send)
            return

        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        auth_header = headers.get(b"authorization", b"").decode()
        token = auth_header.removeprefix("Bearer ").strip()

        user_id: str | None = None
        if token:
            try:
                user_id = await self._validate_token(token)
            except Exception as exc:
                logger.error(f"MCP token validation error: {exc}")

        if not user_id:
            logger.warning("MCP request rejected: missing or invalid Bearer token")
            await self._send_401(scope, receive, send)
            return

        # Stamp context var so tool handlers can call get_current_user_id()
        _current_user_id.set(user_id)
        await self._app(scope, receive, send)

    @staticmethod
    async def _send_401(scope, receive, send) -> None:
        if scope["type"] == "http":
            body = json.dumps({"detail": "Not authenticated"}).encode()
            await send({
                "type": "http.response.start",
                "status": 401,
                "headers": [
                    [b"content-type", b"application/json"],
                    [b"www-authenticate", b"Bearer"],
                    [b"content-length", str(len(body)).encode()],
                ],
            })
            await send({"type": "http.response.body", "body": body})
        elif scope["type"] == "websocket":
            await receive()  # consume the WebSocket connect message
            await send({"type": "websocket.close", "code": 4401})


async def create_mcp_server(
    name: str,
    validate_token: Callable[[str], Awaitable[str | None]],
    streamable_http_path: str = "/",
) -> tuple[FastMCP, MCPAuthMiddleware]:
    """Create an MCP server with Bearer token auth middleware.

    Args:
        name: Server name for FastMCP.
        validate_token: Async function that takes a token string and returns
            user_id (str) if valid, or None if the token is invalid or expired.
        streamable_http_path: HTTP path for the streamable transport endpoint.

    Returns:
        Tuple of (FastMCP instance, MCPAuthMiddleware instance). Mount the
        middleware's ASGI app — obtained via ``middleware(mcp.streamable_http_app())``
        — into your FastAPI app at the desired path.

    Example::

        mcp, auth_middleware = await create_mcp_server(
            name="MyApp",
            validate_token=my_token_validator,
        )

        @mcp.tool()
        async def my_tool() -> str:
            user_id = get_current_user_id()
            return f"Hello {user_id}"

        app.mount("/mcp", auth_middleware)
    """
    mcp = FastMCP(name, streamable_http_path=streamable_http_path)
    middleware = MCPAuthMiddleware(mcp.streamable_http_app(), validate_token)
    return mcp, middleware
