"""Helm Agent — Standalone API Server.

This is the primary entry-point for running the Helm Agent as an independent
API service. It exposes:

  GET  /                → Chat UI (chat_ui.html)
  GET  /health          → {"status": "ok", "model": "..."}
  POST /api/chat        → Streaming Vercel AI SDK SSE  (used by chat_ui.html)
  POST /api/run         → Simple SSE stream for backend integration:
                            data: {"type":"token","text":"..."}\n\n
                            data: {"type":"done","text":"..."}\n\n
  GET  /api/configure   → Model info (used by chat_ui.html)

Usage
-----
    cd agent
    python api_server.py              # default port 7860
    python api_server.py --port 8080  # custom port
    uvicorn api_server:app --port 7860 --reload

The /api/run endpoint is designed for the Helm backend to consume. When
EXTERNAL_AGENT_URL is set in .env, the backend's agent_proxy will forward
mobile-app chat messages to this endpoint instead of calling OpenRouter directly.

Architecture
------------
  Mobile App ─── WebSocket ──► Backend ──► /api/run ──► Helm Agent ──► MCP ──► Helm Backend
  Browser   ─────── HTTP  ──► /api/chat ──► Helm Agent ──► MCP ──► Helm Backend
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# ── Repo setup ────────────────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_REPO_ROOT))

from dotenv import load_dotenv

load_dotenv(_REPO_ROOT / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
AGENT_WEB_PORT: int = int(os.environ.get("AGENT_WEB_PORT", "7860"))
AGENT_HOST: str = os.environ.get("AGENT_HOST", "0.0.0.0")

_local_ui = Path(__file__).parent / "chat_ui.html"

# ── Import agent builder ───────────────────────────────────────────────────────
# Import only the builder + env-check from helm_agent (no side-effects from __main__)
from helm_agent import _build_agent, _check_env, OPENROUTER_MODEL  # noqa


def _create_app():
    """Build a Starlette app with CORS, custom endpoints, and the pydantic-ai API.

    Route table (order matters — first match wins):
      GET  /          → chat_ui.html
      GET  /health    → {"status":"ok","model":"..."}
      POST /api/run   → SSE stream for backend integration
      *    /api/*     → pydantic-ai sub-app (chat, configure, health)
    """
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware
    from starlette.requests import Request
    from starlette.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
    from starlette.routing import Mount, Route
    from pydantic_ai.ui._web.api import create_api_app

    agent = _build_agent()

    # pydantic-ai's API sub-app handles /chat and /configure
    # It is mounted at /api so externally: /api/chat, /api/configure, /api/health
    pydantic_api = create_api_app(agent)

    # ── HTML handler ───────────────────────────────────────────────────────────
    _html_content: list[str] = []  # lazy cache

    async def index(request: Request) -> Response:
        if not _html_content:
            _html_content.append(_local_ui.read_text(encoding="utf-8"))
        return HTMLResponse(
            content=_html_content[0],
            headers={"Cache-Control": "public, max-age=3600"},
        )

    # ── Health endpoint ────────────────────────────────────────────────────────
    async def health(request: Request) -> Response:
        return JSONResponse({"status": "ok", "model": OPENROUTER_MODEL})

    # ── /api/run — simple SSE endpoint for backend forwarding ─────────────────
    # Request body: {"message": "<user text>"}
    # SSE stream:
    #   data: {"type": "token", "text": "<delta>"}\n\n
    #   data: {"type": "done",  "text": "<full text>"}\n\n
    async def run_endpoint(request: Request) -> Response:
        try:
            data = await request.json()
        except Exception:
            return JSONResponse({"error": "Invalid JSON"}, status_code=400)

        message = (data.get("message") or "").strip()
        if not message:
            return JSONResponse({"error": "message is required"}, status_code=400)

        async def generate():
            try:
                async with agent.run_stream(message) as result:
                    full_text = []
                    async for chunk in result.stream_text(delta=True):
                        full_text.append(chunk)
                        yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
                    yield f"data: {json.dumps({'type': 'done', 'text': ''.join(full_text)})}\n\n"
            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'text': str(exc)})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ── Assemble app ───────────────────────────────────────────────────────────
    app = Starlette(
        routes=[
            Route("/", index, methods=["GET"]),
            Route("/health", health, methods=["GET"]),
            Route("/api/run", run_endpoint, methods=["POST"]),
            Mount("/api", app=pydantic_api),
        ],
        middleware=[
            Middleware(
                CORSMiddleware,
                allow_origins=["*"],
                allow_methods=["*"],
                allow_headers=["*"],
            )
        ],
    )
    return app


app = _create_app()


# ── Entry point ───────────────────────────────────────────────────────────────

def _parse_args():
    parser = argparse.ArgumentParser(
        prog="api_server",
        description="Helm Agent API Server — independent agent service",
    )
    parser.add_argument("--port", type=int, default=AGENT_WEB_PORT)
    parser.add_argument("--host", default=AGENT_HOST)
    return parser.parse_args()


if __name__ == "__main__":
    import uvicorn

    args = _parse_args()
    _check_env()

    print("⎈  Helm Agent API Server")
    print(f"   Model  : {OPENROUTER_MODEL}")
    print(f"   Port   : {args.port}")
    print(f"   Chat UI: http://localhost:{args.port}/")
    print(f"   API Run: POST http://localhost:{args.port}/api/run")
    print()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
