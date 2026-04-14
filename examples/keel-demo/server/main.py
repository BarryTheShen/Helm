"""Keel Demo Server — minimal FastAPI backend demonstrating the full AI-to-UI loop.

This server uses keel-server's pre-built MCP tools and ConnectionManager to show
how an AI agent can dynamically render SDUI screens that users interact with.

Run:
    cd examples/keel-demo/server
    pip install "keel-server[dev]" uvicorn
    uvicorn main:app --reload --port 8765

The demo includes a simple rule-based "AI" that generates SDUI screens in response
to user messages. Replace the respond_to_message() function with a real LLM call
to see the full potential.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from keel_server import ConnectionManager, normalize_sdui_screen
from keel_server.sdui_tools import InMemoryScreenStore


# ── State ────────────────────────────────────────────────────────────────

manager = ConnectionManager()
store = InMemoryScreenStore()

# Simple user for demo (no auth required)
DEMO_USER = "demo-user"


# ── AI Responder ─────────────────────────────────────────────────────────

def respond_to_message(message: str) -> tuple[str, dict[str, Any]]:
    """Generate a text reply and an SDUI screen in response to a user message.

    Returns (text, screen) — the text is shown as a chat bubble, the screen
    renders inline as interactive UI. In production, you'd call an LLM that
    generates both the conversational text and the SDUI JSON.
    """
    msg_lower = message.lower().strip()

    if any(w in msg_lower for w in ["hello", "hi", "hey"]):
        return "Hey! Here are some things I can show you:", _make_screen("greeting", "Hello!", [
            _text_row("greeting-text", "Hello! I'm the Keel demo AI. Try asking me to:", "heading"),
            _text_row("hint-1", "• Show a form (type 'form')"),
            _text_row("hint-2", "• Show a dashboard (type 'dashboard')"),
            _text_row("hint-3", "• Show buttons (type 'buttons')"),
            _text_row("hint-4", "• Show any message and I'll echo it back"),
        ])

    if "form" in msg_lower:
        return "Here's a form you can fill out:", _make_screen("dynamic-form", "Contact Form", [
            _text_row("form-title", "Fill out this form", "heading"),
            _row("form-row", {
                "type": "Form",
                "id": "contact-form",
                "props": {
                    "title": "Contact Us",
                    "fields": [
                        {"id": "name", "type": "text", "label": "Your Name", "required": True},
                        {"id": "email", "type": "email", "label": "Email", "required": True},
                        {"id": "subject", "type": "select", "label": "Subject", "options": [
                            {"label": "General", "value": "general"},
                            {"label": "Support", "value": "support"},
                            {"label": "Feedback", "value": "feedback"},
                        ]},
                        {"id": "message", "type": "textarea", "label": "Message"},
                    ],
                    "submit_label": "Send Message",
                    "submit_action": {
                        "type": "server_action",
                        "function": "submit_contact",
                    },
                },
            }),
        ])

    if "dashboard" in msg_lower:
        return "Here's your dashboard:", _make_screen("dashboard", "Dashboard", [
            _text_row("dash-title", "Your Dashboard", "heading"),
            _row("stats-row", {
                "type": "Container",
                "id": "stats-container",
                "props": {"direction": "row", "gap": 8, "justify": "space-between"},
                "children": [
                    {"type": "Text", "id": "stat-1", "props": {"content": "Users: 1,234", "bold": True}},
                    {"type": "Text", "id": "stat-2", "props": {"content": "Revenue: $5.6K", "bold": True}},
                    {"type": "Text", "id": "stat-3", "props": {"content": "Growth: +12%", "bold": True, "color": "#4CAF50"}},
                ],
            }),
            _divider_row(),
            _text_row("chart-placeholder", "Chart data would render here via a custom component"),
            _divider_row(),
            _row("action-row", {
                "type": "Container",
                "id": "action-buttons",
                "props": {"direction": "row", "gap": 8},
                "children": [
                    {"type": "Button", "id": "refresh-btn", "props": {
                        "label": "Refresh Data",
                        "variant": "primary",
                        "action": {"type": "server_action", "function": "refresh_dashboard"},
                    }},
                    {"type": "Button", "id": "export-btn", "props": {
                        "label": "Export CSV",
                        "variant": "outlined",
                        "action": {"type": "server_action", "function": "export_data"},
                    }},
                ],
            }),
        ])

    if "button" in msg_lower:
        return "Try tapping these:", _make_screen("buttons", "Interactive Buttons", [
            _text_row("btn-title", "Try these buttons", "heading"),
            _row("btn-row-1", {
                "type": "Container",
                "id": "btn-container",
                "props": {"direction": "row", "gap": 8, "wrap": True},
                "children": [
                    {"type": "Button", "id": f"btn-{i}", "props": {
                        "label": label,
                        "variant": variant,
                        "action": {"type": "send_to_agent", "message": f"You clicked {label}!"},
                    }}
                    for i, (label, variant) in enumerate([
                        ("Primary", "primary"),
                        ("Secondary", "outlined"),
                        ("Danger", "primary"),
                        ("Info", "outlined"),
                    ])
                ],
            }),
            _text_row("btn-hint", "Each button sends a message back to me, and I respond with a new screen."),
        ])

    # Default: echo back with a styled card
    return f'I heard you say "{message}". Here\'s what I can do:', _make_screen("echo", "Echo", [
        _text_row("echo-title", "You said:", "heading"),
        _row("echo-content", {
            "type": "Container",
            "id": "echo-card",
            "props": {
                "padding": 16,
                "backgroundColor": "#F5F5F5",
                "borderRadius": 12,
            },
            "children": [
                {"type": "Text", "id": "echo-text", "props": {"content": message, "italic": True}},
            ],
        }),
        _divider_row(),
        _text_row("echo-hint", "Try: 'hello', 'form', 'dashboard', or 'buttons'"),
    ])


def handle_server_action(function: str, params: dict[str, Any] | None) -> tuple[str, dict[str, Any]]:
    """Handle a server_action from the frontend. Returns (text, screen)."""
    if function == "submit_contact":
        return "Got it! Your form has been submitted.", _make_screen("form-success", "Submitted!", [
            _text_row("success-icon", "✓", "heading"),
            _text_row("success-msg", "Form submitted successfully!"),
            _text_row("success-data", f"Data: {json.dumps(params or {}, indent=2)}"),
            _row("back-btn-row", {
                "type": "Button",
                "id": "back-btn",
                "props": {
                    "label": "Back to Chat",
                    "variant": "primary",
                    "action": {"type": "send_to_agent", "message": "hello"},
                },
            }),
        ])

    if function == "refresh_dashboard":
        return respond_to_message("dashboard")

    # Default acknowledgement
    return f"Done! Executed '{function}'.", _make_screen("action-result", "Action Received", [
        _text_row("ack-title", f"Executed: {function}", "heading"),
        _text_row("ack-params", f"Params: {json.dumps(params or {})}"),
    ])


def handle_form_submit(form_id: str, data: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Handle a form_submit action. Returns (text, screen)."""
    return handle_server_action("submit_contact", data)


# ── Screen Builders ──────────────────────────────────────────────────────

def _make_screen(module_id: str, title: str, rows: list[dict]) -> dict[str, Any]:
    return {
        "schema_version": "1.0.0",
        "module_id": module_id,
        "title": title,
        "rows": rows,
    }


def _text_row(row_id: str, content: str, variant: str = "body") -> dict[str, Any]:
    return {
        "id": f"row-{row_id}",
        "cells": [{
            "id": f"cell-{row_id}",
            "width": 1,
            "content": {
                "type": "Text",
                "id": row_id,
                "props": {"content": content, "variant": variant},
            },
        }],
    }


def _divider_row() -> dict[str, Any]:
    div_id = str(uuid4())[:8]
    return {
        "id": f"row-div-{div_id}",
        "cells": [{
            "id": f"cell-div-{div_id}",
            "width": 1,
            "content": {"type": "Divider", "id": f"div-{div_id}", "props": {"spacing": 16}},
        }],
    }


def _row(row_id: str, content: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"row-{row_id}",
        "cells": [{
            "id": f"cell-{row_id}",
            "width": 1,
            "content": content,
        }],
    }


# ── WebSocket Endpoint ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Send welcome screen to new connections
    yield


app = FastAPI(title="Keel Demo Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "connected_users": len(manager.connected_user_ids)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for the demo.

    Protocol:
    - Client sends: {"type": "send_to_agent", "message": "..."}
    - Client sends: {"type": "server_action", "function": "...", "params": {...}}
    - Client sends: {"type": "form_submit", "form_id": "...", "data": {...}}
    - Server responds: {"type": "screen_update", "screen": <SDUIPage>}
    """
    await manager.connect(websocket, user_id=DEMO_USER)

    # Send welcome screen immediately
    text, welcome = respond_to_message("hello")
    normalized = normalize_sdui_screen(welcome)
    await store.save_screen(DEMO_USER, normalized["module_id"], normalized)
    await websocket.send_json({"type": "screen_update", "text": text, "screen": normalized})

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            action_type = data.get("type", "")

            text: str = ""
            screen: dict[str, Any] | None = None

            if action_type == "send_to_agent":
                message = data.get("message", "")
                text, screen = respond_to_message(message)

            elif action_type == "server_action":
                fn = data.get("function", "unknown")
                params = data.get("params")
                text, screen = handle_server_action(fn, params)

            elif action_type == "form_submit":
                form_id = data.get("form_id", "")
                form_data = data.get("data", {})
                text, screen = handle_form_submit(form_id, form_data)

            else:
                text = f"Received: {action_type}"
                screen = _make_screen("unknown", "Unknown Action", [
                    _text_row("unk", f"Received action: {action_type}"),
                    _text_row("unk-data", json.dumps(data, indent=2)),
                ])

            if screen:
                normalized = normalize_sdui_screen(screen)
                await store.save_screen(DEMO_USER, normalized.get("module_id", "dynamic"), normalized)
                await websocket.send_json({"type": "screen_update", "text": text, "screen": normalized})

    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id=DEMO_USER)
    except Exception as e:
        await manager.disconnect(websocket, user_id=DEMO_USER)
        raise
