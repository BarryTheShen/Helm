# keel-server

FastAPI helpers, MCP server factory, WebSocket connection manager, and SDUI normalization for Keel AI-UI applications.

---

## What Is keel-server

`keel-server` is the Python counterpart to the Keel frontend packages. It provides the infrastructure an AI-driven app needs on the server side: a factory for creating an MCP server with Bearer token authentication, a `ConnectionManager` for multi-user multi-device WebSocket sessions, an `ActionRegistry` for dispatching SDUI `server_action` events, and `normalize_sdui_screen()` to fix flat AI-generated JSON into the props-based schema the frontend expects. Nothing in this package is coupled to any specific app's database or session layer — all dependencies are injected by the caller.

---

## Install

```bash
pip install keel-server
```

Requirements: Python >= 3.11, `fastapi >= 0.115`, `mcp >= 1.6`, `loguru >= 0.7`.

---

## Quick Start

Create an MCP server with pre-built SDUI tools and mount it into a FastAPI app:

```python
from fastapi import FastAPI
from keel_server import create_mcp_server
from keel_server.sdui_tools import register_sdui_tools, InMemoryScreenStore

app = FastAPI()

async def validate_token(token: str) -> str | None:
    """Return user_id if valid, None if invalid."""
    return await db.get_user_id_for_token(token)

mcp, auth_middleware = await create_mcp_server(
    name="MyApp",
    validate_token=validate_token,
)

# Register pre-built SDUI tools — AI agents can now render screens immediately
register_sdui_tools(mcp, InMemoryScreenStore())

# Mount the authenticated ASGI app
app.mount("/mcp", auth_middleware)
```

Any MCP-compatible AI client connecting to `/mcp` can now call `render_screen`, `update_component`, `get_screen`, `list_screens`, and `validate_form`. Invalid or missing Bearer tokens receive a `401` response.

You can also register your own custom tools alongside the pre-built ones:

```python
from keel_server import get_current_user_id

@mcp.tool()
async def greet() -> str:
    user_id = get_current_user_id()
    return f"Hello, {user_id}"
```

---

## ConnectionManager

`ConnectionManager` tracks WebSocket connections keyed by `user_id` and `device_id`. All mutations are guarded by an `asyncio.Lock` to prevent races under concurrent connect/disconnect/send operations.

```python
from keel_server import ConnectionManager

manager = ConnectionManager()

# In a FastAPI WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, user_id: str, device_id: str):
    await manager.connect(websocket, user_id=user_id, device_id=device_id)
    try:
        while True:
            data = await websocket.receive_json()
            # handle incoming messages
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id=user_id)
```

### Methods

| Method | Description |
|--------|-------------|
| `connect(ws, user_id, device_id?)` | Accept and register a connection |
| `disconnect(ws, user_id)` | Remove a connection; cleans up empty user entries |
| `send(user_id, message)` | Send JSON to all devices for a user |
| `send_to_device(user_id, device_id, message)` | Send JSON to a specific device |
| `broadcast(message)` | Send JSON to all connected users |
| `is_connected(user_id)` | Check if a user has any active connections |
| `connected_user_ids` | Property — list of all currently connected user IDs |
| `get_device_ids(user_id)` | List device IDs connected for a user |

Dead connections are cleaned up automatically: if a `send()` raises an exception, the websocket is disconnected before the call returns.

---

## ActionRegistry

`ActionRegistry` maps named handlers to SDUI `server_action` events. It is the whitelist of server-side functions that SDUI components are allowed to invoke.

```python
from keel_server import ActionRegistry

registry = ActionRegistry()

async def book_appointment(date: str, time: str) -> dict:
    # business logic
    return {"status": "booked", "date": date, "time": time}

registry.register("bookAppointment", book_appointment)

# In a route that handles incoming server_action events
result = await registry.execute("bookAppointment", date="2025-04-15", time="10:00")
```

| Method | Description |
|--------|-------------|
| `register(name, handler)` | Register an async callable under a name |
| `execute(name, **kwargs)` | Call the handler; raises `ValueError` if name is unknown |
| `list_actions()` | Return list of all registered action names |
| `is_registered(name)` | Check if a name has a handler |

---

## normalize_sdui_screen()

AI models often generate flat SDUI JSON with component fields at the top level instead of inside a `props` key. `normalize_sdui_screen()` fixes this before storage or before serving to the frontend.

Input (flat, AI-generated):

```json
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "rows": [
    {
      "id": "row-1",
      "cells": [
        {
          "id": "cell-1",
          "content": {
            "type": "text",
            "id": "txt-1",
            "content": "Hello"
          }
        }
      ]
    }
  ]
}
```

Output (props-based, frontend-compatible):

```json
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "rows": [
    {
      "id": "row-1",
      "cells": [
        {
          "id": "cell-1",
          "content": {
            "type": "text",
            "id": "txt-1",
            "props": { "content": "Hello" }
          }
        }
      ]
    }
  ]
}
```

```python
from keel_server import normalize_sdui_screen

normalized = normalize_sdui_screen(raw_screen)
```

The function handles V2 row-based format (`rows[] -> cells[] -> content`). Components that already have a `props` key are returned unchanged. Unknown component types are handled liberally: all non-structural keys are moved into `props`.

---

## Pre-Built MCP Tools (register_sdui_tools)

`register_sdui_tools()` registers 5 ready-to-use MCP tools onto your server. Any AI agent that connects via MCP can immediately render screens, update components, and validate forms — no custom tool code required.

```python
from keel_server import create_mcp_server
from keel_server.sdui_tools import register_sdui_tools, InMemoryScreenStore

mcp, auth_middleware = await create_mcp_server("MyApp", validate_token=my_validator)
register_sdui_tools(mcp, InMemoryScreenStore())

# That's it — AI agents can now call render_screen, update_component, etc.
app.mount("/mcp", auth_middleware)
```

### Registered Tools

| Tool | What it does |
|------|-------------|
| `render_screen(module_id, title, rows)` | AI generates a full SDUI screen. Normalizes and stores it. |
| `get_screen(module_id)` | Retrieve the current screen for a module. |
| `update_component(module_id, component_id, props)` | Patch a single component's props by ID without rebuilding the full screen. |
| `list_screens()` | List all module IDs with stored screens for the current user. |
| `validate_form(fields, data)` | Validate form submission data against field definitions. Returns `{valid, errors}`. |

### ScreenStore

Tools persist screens via a `ScreenStore` — a simple async interface you implement against your storage layer:

```python
class ScreenStore(Protocol):
    async def save_screen(self, user_id: str, module_id: str, screen: dict) -> None: ...
    async def get_screen(self, user_id: str, module_id: str) -> dict | None: ...
    async def list_screens(self, user_id: str) -> list[str]: ...
```

`InMemoryScreenStore` is included for demos and testing. For production, implement `ScreenStore` against your database (SQLAlchemy, Redis, etc.).

---

## MCPAuthMiddleware

`MCPAuthMiddleware` is an ASGI middleware that validates Bearer tokens before forwarding requests to the MCP server. FastAPI's `Depends()` system does not apply to mounted ASGI sub-apps, so auth is handled at the ASGI level here.

```python
from keel_server import MCPAuthMiddleware

middleware = MCPAuthMiddleware(
    app=inner_asgi_app,
    validate_token=your_async_validator,
)

# mount_path receives the middleware, not the inner app directly
fastapi_app.mount("/mcp", middleware)
```

The `validate_token` callable receives the token string and must return:
- A non-empty `str` (the `user_id`) if the token is valid.
- `None` if the token is invalid or expired.

Invalid tokens receive a `401 Not authenticated` JSON response. Invalid WebSocket connections receive close code `4401`.

---

## get_current_user_id()

After `MCPAuthMiddleware` validates a request, it stamps the resolved `user_id` into a `contextvars.ContextVar`. MCP tool handlers retrieve it without any extra parameters:

```python
from keel_server import get_current_user_id

@mcp.tool()
async def get_my_data() -> dict:
    user_id = get_current_user_id()
    return await db.fetch_user_data(user_id)
```

The context var is per-request: concurrent requests from different users never see each other's `user_id`.

---

## Full FastAPI Integration Example

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from keel_server import (
    ConnectionManager,
    ActionRegistry,
    create_mcp_server,
    get_current_user_id,
    normalize_sdui_screen,
)

manager = ConnectionManager()
registry = ActionRegistry()
mcp = None

async def validate_token(token: str) -> str | None:
    return await db.get_user_id_for_token(token)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mcp
    mcp_server, auth_middleware = await create_mcp_server(
        name="MyApp",
        validate_token=validate_token,
    )
    mcp = mcp_server

    @mcp_server.tool()
    async def set_screen(module_id: str, screen: dict) -> str:
        user_id = get_current_user_id()
        normalized = normalize_sdui_screen(screen)
        await db.save_screen(user_id, module_id, normalized)
        await manager.send(user_id, {"type": "sdui_screen_update", "data": normalized})
        return "ok"

    app.mount("/mcp", auth_middleware)
    yield

app = FastAPI(lifespan=lifespan)

# Register action handlers
async def handle_submit(form_data: dict) -> dict:
    return {"status": "received", "data": form_data}

registry.register("submitForm", handle_submit)

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id=user_id)
    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "server_action":
                result = await registry.execute(
                    msg["function"], **msg.get("params", {})
                )
                await manager.send(user_id, {"type": "action_result", "data": result})
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id=user_id)
```

---

## Requirements

| Package | Version |
|---------|---------|
| Python | >= 3.11 |
| `fastapi` | >= 0.115 |
| `mcp` | >= 1.6 |
| `loguru` | >= 0.7 |
