# Backend — Python FastAPI Server

## Tier 1: TLDR

The backend is a **Python FastAPI** server that serves as the brain of the Helm super app. It handles:

- **User authentication** (signup, login, logout with JWT tokens + device tracking)
- **REST APIs** for calendar events, chat history, notifications, workflows, modules, and AI agent configuration
- **WebSocket server** for real-time chat streaming between the mobile app and AI
- **AI Agent Proxy** that streams LLM responses (OpenAI-compatible API) back to the app with tool-calling support
- **MCP Server** mounted at `/mcp` — exposes tools to external AI agents
- **Workflow Engine** — simple trigger→action automation system using APScheduler
- **SQLite database** (async via aiosqlite + SQLAlchemy)

**To run it:** `cd backend && uvicorn app.main:app --reload`
**To run tests:** `cd backend && pytest`

---

## Tier 2: Deeper Explanation

### Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    FastAPI App (main.py)                │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Routers │  │ Services │  │   MCP    │            │
│  │ (REST +  │  │ (Business│  │ Server   │            │
│  │   WS)    │──│  Logic)  │──│ (/mcp)   │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│        │              │              │                 │
│  ┌─────────────────────────────────────────┐          │
│  │           SQLAlchemy ORM Models          │          │
│  │         (SQLite + aiosqlite)             │          │
│  └─────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Mobile app** → HTTP request or WebSocket message
2. **Router** handles the request, authenticates via Bearer token
3. **Dependency injection** (`dependencies.py`) validates the token against the sessions table
4. **Service layer** contains business logic (auth, agent proxy, websocket manager, workflow engine)
5. **Models** (SQLAlchemy ORM) interact with the SQLite database
6. Response sent back to the app

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| FastAPI App | `app/main.py` | Entry point, middleware, router registration |
| Config | `app/config.py` | pydantic-settings loading from `.env` |
| Database | `app/database.py` | Async SQLAlchemy engine + session factory |
| Auth | `app/dependencies.py` | JWT token validation, `get_current_user` dependency |
| Models | `app/models/` | 9 SQLAlchemy ORM models (User, Session, Device, ChatMessage, CalendarEvent, Notification, Workflow, AgentConfig, ModuleState) |
| Schemas | `app/schemas/` | Pydantic request/response models |
| Routers | `app/routers/` | 8 route files (auth, calendar, chat, notifications, workflows, modules, agent_config, websocket) |
| Services | `app/services/` | Auth logic, Agent Proxy (LLM streaming), WebSocket Manager, Workflow Engine |
| MCP | `app/mcp/` | MCP server + 9 tool implementations |
| Utils | `app/utils/` | JWT + bcrypt password helpers |
| Tests | `tests/` | pytest-asyncio with in-memory SQLite |

### Database Tables (9 total)

| Table | Key Fields |
|-------|-----------|
| `users` | id, username, password_hash, role (admin/user) |
| `devices` | id, user_id, device_id, device_name, config_json |
| `sessions` | id, user_id, device_id, token, expires_at, is_active |
| `chat_messages` | id, user_id, role (user/assistant/system/tool), content |
| `calendar_events` | id, user_id, title, start_time, end_time, description, color, location, is_all_day |
| `notifications` | id, user_id, title, message, severity, actions (JSON), is_read |
| `workflows` | id, user_id, name, trigger_type, trigger_config, action_config, is_active, run_count |
| `agent_configs` | id, user_id, provider, model, api_key_encrypted, system_prompt, temperature, max_tokens |
| `module_states` | id, user_id, module_type, state_json, version |

### API Endpoints Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | No | Health check |
| GET | `/auth/status` | No | Is server set up? |
| POST | `/auth/setup` | No | Create first admin user |
| POST | `/auth/login` | No | Login → session token |
| POST | `/auth/refresh` | Yes | Refresh session token |
| POST | `/auth/logout` | Yes | Invalidate session |
| GET | `/api/calendar/events` | Yes | List calendar events |
| POST | `/api/calendar/events` | Yes | Create event |
| PUT | `/api/calendar/events/{id}` | Yes | Update event |
| DELETE | `/api/calendar/events/{id}` | Yes | Delete event |
| GET | `/api/chat/history` | Yes | Get chat history |
| DELETE | `/api/chat/history` | Yes | Clear chat history |
| GET | `/api/notifications` | Yes | List notifications |
| POST | `/api/notifications/{id}/read` | Yes | Mark notification read |
| POST | `/api/notifications/read-all` | Yes | Mark all read |
| GET | `/api/workflows` | Yes | List workflows |
| POST | `/api/workflows` | Yes | Create workflow |
| PUT | `/api/workflows/{id}` | Yes | Update workflow |
| DELETE | `/api/workflows/{id}` | Yes | Delete workflow |
| GET | `/api/modules` | Yes | List available modules |
| GET | `/api/modules/{id}/state` | Yes | Get module SDUI state |
| POST | `/api/modules/{id}/action` | Yes | Trigger module action |
| GET | `/api/devices/config` | Yes | Get device tab config |
| PUT | `/api/devices/config` | Yes | Update device config |
| GET | `/api/agent/config` | Yes | Get AI agent config |
| PUT | `/api/agent/config` | Yes | Update AI agent config |
| WS | `/ws?token=...` | Yes (query param) | Real-time WebSocket |

---

## Tier 3: Extensive Detail

### File-by-File Breakdown

#### `app/main.py` — Application Entry Point
- Creates the FastAPI app with CORS middleware (currently allows all origins — tighten for production)
- Registers a `lifespan` handler that starts/stops the APScheduler workflow engine
- Registers all 8 routers
- Mounts the MCP server at `/mcp` (wrapped in try/except so it doesn't crash if MCP deps are missing)
- Has a `/health` endpoint returning `{"status": "ok", "version": "0.1.0"}`

#### `app/config.py` — Settings
- Uses `pydantic-settings` with `.env` file support
- **`.env` path:** resolved as an absolute path using `Path(__file__).parent.parent.parent` (the repo root). This means **`.env` must live at the repo root** (`Helm/.env`), not inside `backend/`. Using a relative path would fail when the server is started from any directory other than the repo root.
- Key settings:
  - `database_url`: defaults to `sqlite+aiosqlite:///./helm.db`
  - `secret_key`: defaults to `"dev-secret-key-change-in-production"` — **MUST be changed for production**
  - `access_token_expire_hours`: 24
  - `refresh_token_expire_days`: 30
  - `openai_api_key`, `openai_base_url`, `openai_model`: AI provider config (fallback, used if no OpenRouter key set)
  - `openrouter_api_key`, `openrouter_base_url`, `openrouter_model`: OpenRouter config (takes precedence over `openai_*` in `agent_proxy.py`). Default model: `arcee-ai/trinity-large-preview:free`
  - `mcp_path`: "/mcp"
- **Important:** Do NOT use a pure reasoning model (e.g. `stepfun/step-3.5-flash:free`, `qwen3-*`, `liquid/lfm-thinking`) as the default. Reasoning-only models return empty `delta.content` — all output is in `delta.reasoning` — and produce **zero output** when the `tools` parameter is included. Use a chat-tuned model.

#### `app/database.py` — Async Database Engine
- Creates SQLAlchemy async engine from config
- Adds `check_same_thread=False` for SQLite compatibility
- Session factory with auto-commit on success, rollback on failure

#### `app/dependencies.py` — FastAPI Dependencies
- `get_current_user()`: Extracts Bearer token → looks up active, non-expired session → returns User object
- `get_token_from_request()`: Just extracts the raw token string
- `get_current_user_id()`: Returns user ID string

#### `app/models/` — SQLAlchemy ORM Models

All models use:
- UUID primary keys (string, 36 chars)
- `TimestampMixin` (created_at, updated_at with server_default)
- Foreign keys to `users.id`

**User** — Has relationships to all other models (cascade delete). Roles: admin/user.

**Device** — Tracks physical devices. Each has a `config_json` storing tab preferences. `device_id` is the client-provided unique identifier.

**Session** — Bearer token session. Tied to both user and device. Has `is_active` flag and `expires_at`. Multiple sessions per device are allowed but old ones get deactivated on new login.

**ChatMessage** — Stores all chat messages (user, assistant, system, tool roles). The extra-data column is `metadata_json` (col) mapped to `metadata` in the Pydantic schema. Do not reference `message_metadata` — that field does not exist.

**CalendarEvent** — Standard calendar event fields. `is_all_day` boolean.

**Notification** — Has severity levels (info/warning/error/success) and optional `actions` JSON array for action buttons.

**Workflow** — Trigger types: event_created, event_updated, form_submitted, schedule, message_received. `trigger_config` holds cron expressions for scheduled workflows. `action_config` holds tool name + args.

**AgentConfig** — Per-user AI provider config. Fields: provider, model, api_key_encrypted (NOTE: currently stored as plaintext — marked as TODO for encryption), base_url, system_prompt, temperature, max_tokens.

**ModuleState** — Stores SDUI state per module per user. Versioned with integer increment.

#### `app/schemas/` — Pydantic Schemas

Request/response models matching the API contracts. Notable patterns:
- `CalendarEventOut` uses `from_attributes = True` for ORM → Pydantic conversion
- `AgentConfigOut` has `api_key_set: bool` instead of exposing the actual key
- Workflow schemas are defined inline in the router (not in schemas dir)

#### `app/routers/auth.py` — Authentication Endpoints

- `GET /auth/status` — Checks if any user exists in DB
- `POST /auth/setup` — Creates the first admin user (409 if already set up)
- `POST /auth/login` — Authenticates user, upserts device, creates session with JWT
- `POST /auth/refresh` — Invalidates old session, creates new one (NOTE: `device_id` is set to `None` on refresh — potential bug)
- `POST /auth/logout` — Deactivates session

#### `app/routers/websocket.py` — WebSocket Endpoint

- `WS /ws?token=...` — Token passed as query parameter
- Validates token against sessions table
- On connect: sends `{"type": "connected", "user_id": "..."}`
- Message types handled:
  - `ping` → responds with `pong`
  - `chat_message` → dispatches to agent proxy as background task
  - `module_action` → sends simple `ack` (placeholder)
  - Unknown → error response

#### `app/services/auth.py` — Auth Business Logic

- `is_setup_complete()` — Checks if any user exists
- `create_first_user()` — Hashes password with bcrypt, creates User
- `authenticate_user()` — Finds user by username, verifies password
- `upsert_device()` — Creates or updates device record, sets default config
- `create_session()` — Invalidates old sessions for device, creates new JWT session
- `get_session_by_token()` — Validates token is active and not expired
- `invalidate_session()` — Sets session `is_active = False`

#### `app/services/agent_proxy.py` — AI Agent Proxy (Core Feature)

This is the heart of the AI functionality:

1. **Receives** user message from WebSocket handler
2. **Loads** agent config (API key, model, system prompt, etc.) from DB
3. **Loads** last 20 chat messages for context
4. **Persists** user message to DB
5. **Calls** LLM via OpenAI-compatible streaming API (httpx)
6. **Streams** tokens back to user via WebSocket as `chat_token` events
7. **Handles** tool calls inline (dispatches to MCP tools)
8. **Persists** full assistant response to DB
9. **Sends** `chat_complete` event when done

Error handling:
- No API key → sends `chat_error` with `no_api_key` code
- LLM API error → sends error with status code
- Network error → sends connection error message
- General exception → sends generic error

Tool definitions sent to LLM: `read_calendar`, `create_event`, `send_notification`, `update_module_state`, `get_chat_history`

#### `app/services/websocket_manager.py` — Connection Manager

- Singleton `manager` instance shared across the app
- Keyed by `user_id` → list of WebSocket connections (multi-device support)
- `send()` sends to ALL connections for a user
- `broadcast()` sends to ALL connected users
- Dead connections auto-cleaned on send failure

#### `app/services/workflow_engine.py` — Automation Engine

- Uses `APScheduler` (AsyncIOScheduler) for cron-based scheduling
- On startup: loads all active scheduled workflows from DB and registers their cron jobs
- `fire_trigger()` — Called by routers/services when events happen. Finds matching workflows and executes them as background tasks
- `_execute_workflow()` — Loads workflow from DB, calls the configured MCP tool with the configured args + event data
- `register_workflow()` / `unregister_workflow()` — Add/remove cron jobs

#### `app/mcp/server.py` — MCP Server

- Uses `FastMCP` from the `mcp` library
- Exposes 9 tools prefixed with `helm_` (read_calendar, create_event, update_event, delete_event, send_notification, get_chat_history, send_chat_message, update_module_state, get_form_data)
- Uses `contextvars` for `_current_user_id` — set per-request by `_MCPAuthMiddleware`
- Returns ASGI app via `get_mcp_asgi_app()` which wraps `mcp.streamable_http_app()` with `_MCPAuthMiddleware`
- **Auth is fully wired:** `_MCPAuthMiddleware` extracts the `Authorization: Bearer <token>` header on every incoming HTTP/WebSocket, validates it via `get_session_by_token`, sets `_current_user_id`, and returns `401` for invalid tokens. Note: FastAPI's `Depends()` doesn't apply to mounted ASGI sub-apps — that's why ASGI-level middleware is required.
- The MCP session manager is started in FastAPI's lifespan (not auto-started by sub-app) — managed manually in `app/main.py` lifespan.
- MCP is mounted at `/mcp` and the `streamable_http_path` is `/` (so the full URL is `http://host/mcp/`). The trailing slash matters.

#### `app/mcp/tools.py` — Tool Implementations

All tools are shared between the Agent Proxy (called directly) and the MCP Server (wrapped):

- `execute_tool()` — Name → handler dispatcher
- `read_calendar()` — Queries events by date range
- `create_event()` — Creates calendar event
- `update_event()` — Updates event fields
- `delete_event()` — Deletes event
- `send_notification()` — Creates notification in DB + pushes via WebSocket
- `get_chat_history()` — Gets last N messages
- `send_chat_message()` — Creates assistant message + pushes via WebSocket
- `update_module_state()` — Upserts module state in DB + pushes SDUI update via WebSocket
- `get_form_data()` — Gets form module state (stub)

#### `app/utils/security.py` — Crypto Utilities

- `hash_password()` / `verify_password()` — bcrypt via passlib
- `create_access_token()` — JWT with HS256, configurable expiry
- `create_refresh_token()` — JWT with 30-day expiry
- `decode_token()` / `get_subject_from_token()` — JWT decode helpers

### Test Infrastructure

Tests use `pytest-asyncio` with:
- **In-memory SQLite** for isolation
- **Per-function fixtures** (fresh DB each test)
- `client` fixture — AsyncClient with DB override
- `auth_client` fixture — Pre-authenticated client (creates user + logs in)

Test files:
- `test_auth.py` — Setup, login, status, logout flows
- `test_calendar.py` — CRUD for calendar events
- `test_notifications.py` — List, mark read, mark all read
- `test_workflows.py` — CRUD for workflows

### Database Migrations

Uses Alembic with async support:
- `de71aeb133e3` — Initial schema (all 9 tables)
- `d4aa5857b012` — Added `run_count` and `last_run_at` to workflows

### Dependencies (pyproject.toml)

Core: FastAPI, uvicorn, SQLAlchemy (async), aiosqlite, Alembic, pydantic + pydantic-settings, python-jose (JWT), passlib + bcrypt, httpx (HTTP client), mcp (MCP server), APScheduler, loguru

Dev: pytest, pytest-asyncio, pytest-cov, anyio

### How to Use

```bash
# Setup
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=app
```

### Environment Variables (.env)

> **The `.env` file must be at the repo root** (`Helm/.env`), not inside `backend/`. `config.py` resolves its path absolutely from the source file location.

```env
DATABASE_URL=sqlite+aiosqlite:///./helm.db
SECRET_KEY=your-production-secret-key-here

# OpenRouter (recommended — free models available)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=arcee-ai/trinity-large-preview:free

# OpenAI (fallback if OpenRouter not set)
# OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o

# Optional: for MCP client scripts
HELM_SESSION_TOKEN=eyJ...
HELM_MCP_URL=http://localhost:8000/mcp/
```

### Known Issues / TODOs

1. **API key encryption** — `api_key_encrypted` in AgentConfig is stored as plaintext. The `encryption_key` setting exists but isn't used yet.
2. **Refresh endpoint** — Sets `device_id=None` on the new session, breaking the device tracking.
3. **CORS** — Currently allows all origins (`"*"`). Should be restricted in production.
4. **Workflow schemas** — Defined inline in the router instead of in `app/schemas/`.
5. **Chat history in agent proxy** — Loads last 20 messages regardless of conversation_id.
6. **`fire_trigger()` never called** — Event-based workflow triggers (event_created, form_submitted, etc.) exist in schema but no router actually calls `fire_trigger()`.
