import contextvars
import json
from uuid import uuid4

from loguru import logger
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.database import AsyncSessionLocal, set_sandbox_mode
from app.models.sandbox_action import SandboxAction


class SandboxMiddleware:
    """Pure ASGI middleware for sandbox mode.

    Checks for X-Helm-Sandbox: true header and sets the contextvars-based
    sandbox flag so that get_db() uses a savepoint + rollback instead of commit.

    Uses a pure ASGI implementation (not BaseHTTPMiddleware) to ensure
    context variables propagate correctly to downstream handlers.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        sandbox_header = headers.get(b"x-helm-sandbox", b"").decode()

        if sandbox_header != "true":
            await self.app(scope, receive, send)
            return

        sandbox_session_id = headers.get(b"x-helm-sandbox-session", b"").decode() or str(uuid4())

        # Collect request body for logging
        request_body_parts: list[bytes] = []
        request_body_complete = False

        async def receive_wrapper() -> Message:
            nonlocal request_body_complete
            message = await receive()
            if message["type"] == "http.request":
                body = message.get("body", b"")
                if body:
                    request_body_parts.append(body)
                if not message.get("more_body", False):
                    request_body_complete = True
            return message

        # Collect response for logging
        response_status = 200
        response_headers: list[tuple[bytes, bytes]] = []
        response_body_parts: list[bytes] = []

        async def send_wrapper(message: Message) -> None:
            nonlocal response_status
            if message["type"] == "http.response.start":
                response_status = message.get("status", 200)
                response_headers.extend(message.get("headers", []))
            elif message["type"] == "http.response.body":
                body = message.get("body", b"")
                if body:
                    response_body_parts.append(body)
            await send(message)

        # Set sandbox mode in the current context — this propagates to all
        # downstream code running in this same async task (including get_db).
        set_sandbox_mode(True)
        try:
            await self.app(scope, receive_wrapper, send_wrapper)
        finally:
            set_sandbox_mode(False)

        # Log the sandbox action to a separate session (main session was rolled back)
        try:
            request_body_bytes = b"".join(request_body_parts)
            request_body = None
            if request_body_bytes:
                try:
                    request_body = json.loads(request_body_bytes)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass

            response_body_bytes = b"".join(response_body_parts)
            response_body = None
            if response_body_bytes:
                try:
                    response_body = json.loads(response_body_bytes)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass

            path = scope.get("path", "")
            method = scope.get("method", "")

            async with AsyncSessionLocal() as log_session:
                action = SandboxAction(
                    id=str(uuid4()),
                    session_id=sandbox_session_id,
                    user_id="anonymous",
                    method=method,
                    path=path,
                    request_body=request_body,
                    response_body=response_body,
                    response_code=response_status,
                )
                log_session.add(action)
                await log_session.commit()
        except Exception as log_exc:
            logger.warning(f"Failed to log sandbox action: {log_exc}")
