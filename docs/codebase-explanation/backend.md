# Backend — Python FastAPI Server

> Last updated: 2026-04-12

## Tier 1: TLDR

The backend is a **Python FastAPI** server that serves as the brain of the Helm super app. It handles:

- **User authentication** (signup, login, logout with JWT tokens + device tracking)
- **REST APIs** for calendar events, chat history, notifications, workflows, modules, AI agent configuration, user management, session management, audit logs, SDUI templates, and component registry
- **WebSocket server** for real-time chat streaming between the mobile app and AI
- **AI Agent Proxy** that streams LLM responses (OpenAI-compatible API) back to the app with tool-calling support
- **MCP Server** mounted at `/mcp` — exposes tools to external AI agents
- **Workflow Engine** — simple trigger→action automation system using APScheduler
- **SQLite database** (async via aiosqlite + SQLAlchemy)
- **Action Registry** — named function whitelist callable from SDUI `server_action` events
- **Audit logging** — automatic audit trail for security-relevant operations
- **Sandbox mode** — ASGI middleware that intercepts DB commits for safe testing
- **Admin panel APIs** — system stats, user/session management, component registry

**To run it:** `cd backend && uvicorn app.main:app --reload`
**To run tests:** `cd backend && pytest`

---

## Tier 2: Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                    FastAPI App (main.py)                │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Routers │  │ Services │  │   MCP    │            │
│  │ (REST +  │──│ (Business│──│ Server   │            │
│  │   WS)    │  │  Logic)  │  │ (/mcp)   │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│        │              │              │                 │
│  ┌─────────────────────────────────────────┐          │
│  │           SQLAlchemy ORM Models          │          │
│  │         (SQLite + aiosqlite)             │          │
│  └─────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────┘
```

### Request Flow

1. Mobile app → HTTP request or WebSocket message
2. Router handles the request, authenticates via Bearer token
3. `dependencies.py` validates the token against the sessions table
4. Service layer contains business logic
5. Models (SQLAlchemy ORM) interact with the SQLite database
6. Response sent back to the app

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| FastAPI App | `app/main.py` | Entry point, middleware, router registration, lifespan |
| Config | `app/config.py` | pydantic-settings loading from `.env` (resolves from repo root) |
| Database | `app/database.py` | Async SQLAlchemy engine + session factory |
| Auth dependencies | `app/dependencies.py` | `get_current_user`, `get_current_user_id`, `get_token_from_request`, `require_admin`, `PaginationParams` |
| Models | `app/models/` | 14 SQLAlchemy ORM models |
| Schemas | `app/schemas/` | Pydantic request/response models (15 files) |
| Routers | `app/routers/` | 15 route files |
| Services | `app/services/` | auth, agent_proxy, websocket_manager, workflow_engine, action_registry, audit, component_seed |
| SDUI shared contract helpers | `app/services/sdui_state.py` | Live/draft key helpers, shared validate/apply pipeline, row-aware counters, and broadcast utilities used by REST + MCP |
| Middleware | `app/middleware/sandbox.py` | Sandbox mode ASGI middleware |
| MCP | `app/mcp/` | MCP server + shared tool implementations |
| Utils | `app/utils/security.py` | JWT + bcrypt password helpers |
| CLI | `manage.py` (backend root) | User management CLI |
| Tests | `tests/` | pytest-asyncio with in-memory SQLite |

### `main.py` — App Setup

**Middleware:**
- `CORSMiddleware`: `allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`
- `SandboxMiddleware`: Checks `X-Helm-Sandbox` header; intercepts DB commits in sandbox mode

**Lifespan events:**
- Startup: `start_scheduler()`, starts MCP session manager, creates `_run_time_alerts()` background task, seeds component registry
- Shutdown: cancels alert task, stops MCP session manager, `stop_scheduler()`

**Background task `_run_time_alerts()`**: Every 2 minutes, saves a Notification to DB for every connected user and broadcasts a notification via WebSocket. Controlled by `DEMO_TIME_ALERTS=true` env var.

**Routers registered:** auth, modules, chat, calendar, notifications, agent_config, workflows, actions, websocket, users, sessions, audit, components, templates, admin

**MCP mounted:** `app.mount(settings.mcp_path, _MCPAuthMiddleware(mcp.streamable_http_app()))` → at `/mcp`

---

## Database Tables (14 total)

| Table | Key Fields |
|-------|-----------|
| `users` | id (UUID PK), username (unique), password_hash, role (admin/user) |
| `devices` | id, user_id (FK), device_name, device_id (unique), config_json, last_seen |
| `sessions` | id, user_id (FK), device_id (FK), token (unique), expires_at, is_active |
| `chat_messages` | id, user_id (FK), role (user/assistant/system/tool), content, metadata_json |
| `calendar_events` | id, user_id (FK), title, start_time, end_time, description, color, location, is_all_day |
| `notifications` | id, user_id (FK), title, message, severity (info/warning/error/success), actions (JSON), is_read |
| `workflows` | id, user_id (FK), name, trigger_type (enum), trigger_config, action_config, is_active, run_count, last_run_at |
| `agent_configs` | id, user_id (FK, unique), provider, model, api_key_encrypted, base_url, system_prompt, temperature, max_tokens, is_active |
| `module_states` | id, user_id (FK), module_type (string key), state_json, version |
| `audit_logs` | id, user_id (FK), action (string), resource_type, resource_id, details (JSON), ip_address, created_at |
| `component_registry` | id, type (unique), category (atomic/structural/composite/hardcoded), display_name, description, props_schema (JSON), is_active |
| `sdui_templates` | id, name, description, module_id, screen_json, tags (JSON), is_public, user_id (FK), created_at, updated_at |
| `sdui_screen_history` | id, module_id, user_id (FK), screen_json, version, source (user/ai/template), created_at |
| `sandbox_actions` | id, user_id, method, path, request_body, timestamp |

**`module_states` key naming conventions:**
| Key | Content |
|-----|---------|
| `sdui__{module_id}` | Live SDUI screen JSON (e.g. `sdui__home`) |
| `sdui__{module_id}__draft` | Pending draft awaiting user approval |
| `config__{module_id}` | Current per-module SDUI config such as `auto_approve_drafts` |
| `sdui__{module_id}__config` | Legacy SDUI-scoped config key still read for backward compatibility |
| `_tabs_config` | `{"hidden_tabs": [...]}` — per-user hidden tab list |
| `_custom_modules` | `[{id, name, icon}, ...]` — per-user custom module definitions |
| `form_data__{form_id}` | Form submission history |
| `notes__{user_id}` | Notes data |

**Default `devices.config_json`:** `{"tab_bar_modules": ["chat", "calendar", "alerts"], "default_module": "chat", "nav_mode": "tabs"}`

---

## API Endpoints (Full Reference)

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/status` | ❌ | `{setup_complete, server_name, version}` |
| POST | `/auth/setup` | ❌ | Creates first user (locked with 409 after first use) |
| POST | `/auth/login` | ❌ | Authenticates, upserts device, creates session → token |
| POST | `/auth/refresh` | ✅ | Invalidates old session, issues fresh 24h token |
| POST | `/auth/logout` | ✅ | Invalidates session |

### Modules & SDUI (`/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/modules` | ✅ | List all tabs with enabled/disabled status; includes `is_custom` boolean per module |
| POST | `/api/sdui/modules` | ✅ | Create custom module `{name, icon}` → generates slug-based ID; stored in `_custom_modules` |
| DELETE | `/api/sdui/modules/{module_id}` | ✅ | Delete custom module (blocks built-in deletion); cleans up SDUI data |
| DELETE | `/api/modules/{module_id}` | ✅ | Hide a tab (broadcasts `tabs_updated` WS event) |
| POST | `/api/modules/{module_id}/show` | ✅ | Restore a hidden tab (broadcasts `tabs_updated`) |
| PATCH | `/api/modules/{module_id}/config` | ✅ | Rename tab and/or change icon `{name?, icon?}` — broadcasts `tabs_updated` |
| GET | `/api/modules/{module_id}/state` | ✅ | Get module state; returns defaults if not set |
| POST | `/api/modules/{module_id}/action` | ✅ | Execute mini-app action (random_number, play_rps, create_note, delete_note) |
| GET | `/api/devices/config` | ✅ | Get device tab config (tab_bar_modules, default_module, nav_mode) |
| PUT | `/api/devices/config` | ✅ | Update device tab config |
| GET | `/api/sdui` | ✅ | List live AI-set screens across all modules; `sections_count` counts V2 rows or legacy sections |
| GET | `/api/sdui/{module_id}` | ✅ | Get normalized live SDUI screen `{screen, version}` for module |
| POST | `/api/sdui/{module_id}` | ✅ | Validate + store the shared row-first save/apply contract (legacy sections still accepted); saves a draft unless `auto_approve_drafts` is enabled |
| DELETE | `/api/sdui/{module_id}` | ✅ | Delete live, draft, and config state for a module; broadcasts draft-cleared then live-clear events |
| GET | `/api/sdui/{module_id}/config` | ✅ | Get module SDUI config; reads `config__{module_id}` first, then legacy `sdui__{module_id}__config` |
| PUT | `/api/sdui/{module_id}/config` | ✅ | Set module SDUI config (`auto_approve_drafts`) |
| GET | `/api/sdui/{module_id}/draft` | ✅ | Get pending draft `{screen, has_draft}` |
| POST | `/api/sdui/{module_id}/draft/approve` | ✅ | Approve draft → publish to live screen |
| POST | `/api/sdui/{module_id}/draft/reject` | ✅ | Reject + delete draft; optional `{feedback?}` body |

### Chat (`/api/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chat/history` | ✅ | `{messages, has_more}`; params: `limit=20`, `offset=0` |
| DELETE | `/api/chat/history` | ✅ | Deletes all chat messages for current user |

### Calendar (`/api/calendar`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/calendar/events` | ✅ | List events; optional `start_date`, `end_date`, pagination (`skip`, `limit`, `search`) |
| POST | `/api/calendar/events` | ✅ | Create event; auto-refreshes SDUI calendar screen; fires `EVENT_CREATED` trigger |
| POST | `/api/calendar/add-meeting` | ✅ | User-friendly meeting creation `{title, date, start_time, end_time, description?, color?}` |
| DELETE | `/api/calendar/events/{event_id}` | ✅ | Delete event; auto-refreshes SDUI calendar screen |
| DELETE | `/api/calendar/events/bulk` | ✅ | Bulk delete events `{ids: [...]}` |
| PUT | `/api/calendar/events/{event_id}` | ✅ | Update event fields; fires `EVENT_UPDATED` trigger |

### Notifications (`/api/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | ✅ | List notifications; params: `unread_only=False`, pagination (`skip`, `limit`, `search`) |
| POST | `/api/notifications/{id}/read` | ✅ | Mark one notification as read |
| POST | `/api/notifications/read-all` | ✅ | Mark all notifications as read |
| DELETE | `/api/notifications/bulk` | ✅ | Bulk delete notifications `{ids: [...]}` |

### Agent Config (`/api/agent`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agent/config` | ✅ | Get config (creates default if none); API key never returned, only `api_key_set: bool` |
| PUT | `/api/agent/config` | ✅ | Update config; API key Fernet-encrypted before storage |

### Workflows (`/api/workflows`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/workflows` | ✅ | List user workflows; pagination (`skip`, `limit`, `search`) |
| POST | `/api/workflows` | ✅ | Create workflow; auto-registers with APScheduler if SCHEDULE type |
| PUT | `/api/workflows/{id}` | ✅ | Update; manages scheduler registration |
| DELETE | `/api/workflows/{id}` | ✅ 204 | Delete; unregisters from scheduler |
| DELETE | `/api/workflows/bulk` | ✅ | Bulk delete workflows `{ids: [...]}` |

### Actions (`/api/actions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/actions/execute` | ✅ | Execute a named registered action |
| GET | `/api/actions/functions` | ✅ | List all registered action names |

### WebSocket & Health

| Path | Auth | Description |
|------|------|-------------|
| `WS /ws` | `?token=` query param | Main app WebSocket |
| `GET /health` | ❌ | `{"status": "ok", "version": ...}` |

### User Management (`/api/users`) — Admin Only

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | ✅ Admin | List all users with pagination |
| POST | `/api/users` | ✅ Admin | Create a new user `{username, password, role?}` |
| GET | `/api/users/{id}` | ✅ Admin | Get user by ID |
| PUT | `/api/users/{id}` | ✅ Admin | Update user `{username?, password?, role?}` |
| DELETE | `/api/users/{id}` | ✅ Admin | Delete user |

### Session Management (`/api/sessions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sessions` | ✅ Admin | List all sessions (admin view) |
| GET | `/api/sessions/mine` | ✅ | List current user's sessions |
| DELETE | `/api/sessions/{id}` | ✅ | Revoke a session |
| DELETE | `/api/sessions/revoke-others` | ✅ | Revoke all sessions except current |

### Audit Log (`/api/audit`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/audit` | ✅ Admin | List all audit logs with pagination; filterable by action, resource_type |
| GET | `/api/audit/mine` | ✅ | List current user's audit logs |

### Component Registry (`/api/components`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/components` | ✅ | List all registered SDUI components |
| POST | `/api/components` | ✅ Admin | Register a new component `{type, category, display_name, ...}` |
| GET | `/api/components/{id}` | ✅ | Get component by ID |
| PUT | `/api/components/{id}` | ✅ Admin | Update component |
| DELETE | `/api/components/{id}` | ✅ Admin | Delete component |

### SDUI Templates (`/api/templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/templates` | ✅ | List templates (public + own); pagination |
| POST | `/api/templates` | ✅ | Create template from SDUI JSON |
| GET | `/api/templates/{id}` | ✅ | Get template by ID |
| PUT | `/api/templates/{id}` | ✅ | Update template |
| DELETE | `/api/templates/{id}` | ✅ | Delete template |
| POST | `/api/templates/{id}/apply` | ✅ | Apply template to a module (sets SDUI screen) |
| POST | `/api/templates/import` | ✅ | Import template from JSON export |
| GET | `/api/templates/{id}/rows` | ✅ | Get template rows only |

### Admin Stats (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/stats` | ✅ Admin | System stats (user count, sessions, events, etc.) |
| GET | `/api/admin/workflows/stats` | ✅ Admin | Workflow execution statistics |
| GET | `/api/admin/websocket/stats` | ✅ Admin | Active WebSocket connection info |

### Modules — Screen History & Utilities (added to `/api/sdui`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sdui/{module_id}/history` | ✅ | List screen history for module |
| GET | `/api/sdui/{module_id}/history/{version}` | ✅ | Get specific history entry |
| POST | `/api/sdui/{module_id}/history/{version}/restore` | ✅ | Restore a historical screen version |
| DELETE | `/api/sdui/{module_id}/history` | ✅ | Clear screen history |
| POST | `/api/sdui/validate` | ✅ | Validate SDUI JSON against the same row-first normalize/validate contract used by save/apply |
| POST | `/api/sdui/{module_id}/duplicate` | ✅ | Duplicate a screen to another module |

---

## WebSocket Protocol

**Connection:** `ws://<host>/ws?token=<session_token>&device_id=<optional>`

### Client → Server messages

| `type` | Payload | Action |
|--------|---------|--------|
| `ping` | — | Replies `{type: "pong"}` |
| `chat_message` | `content, conversation_id` | Spawns agent proxy as background task |
| `module_action` | `function, params, ref` | Executes action via registry; replies `action_result` or `action_error` |

### Server → Client messages

| `type` | Payload | When |
|--------|---------|------|
| `connected` | `user_id, device_id` | On connection accepted |
| `pong` | — | After `ping` |
| `chat_start` | `message_id` | AI begins responding and establishes the assistant `message_id` for the stream |
| `chat_token` | `message_id, token` | Each streamed text delta; reuses the `chat_start` `message_id` |
| `chat_message_replace` | `message_id, content` | After XML tool call stripping |
| `chat_complete` | `message_id, content` | Full response done; reuses the same `message_id` |
| `chat_error` | `message, code?` | Error; `code:"no_api_key"` if no LLM configured |
| `notification` | `id?, title, message, severity, actions?, timestamp?` | Push notification |
| `sdui_screen_update` | `module_id, screen, version` | Live SDUI screen updated |
| `sdui_draft_update` | `module_id, screen, version` | New draft ready for approval, or draft cleared when `screen=null` and `version=0` |
| `sdui_draft_rejected` | `module_id` | Legacy companion event when a draft is rejected or cleared |
| `tabs_updated` | `modules: [...]` | Tab visibility changed |
| `module_state_update` | `module, state, version` | Module state changed (legacy) |
| `tool_result` | `tool, result` | Tool call succeeded |
| `tool_error` | `tool, message` | Tool call failed |
| `action_result` | `ref?, result` | Module action completed |
| `action_error` | `ref?, message` | Module action failed |

---

## Services Detail

### `services/auth.py`

| Function | Purpose |
|----------|---------|
| `is_setup_complete(db)` | True if any user exists |
| `create_first_user(db, username, password)` | Creates admin user with bcrypt hash |
| `authenticate_user(db, username, password)` | Validates credentials |
| `upsert_device(db, user_id, device_id, device_name)` | Creates or updates last_seen on Device |
| `create_session(db, user_id, device_id)` | Invalidates existing sessions for device, creates new JWT-signed session |
| `get_session_by_token(db, token)` | Finds active, non-expired session |
| `invalidate_session(db, token)` | Sets `is_active=False` |

### `services/action_registry.py`

Registered built-in actions (singleton `registry`):

| Name | What it does |
|------|-------------|
| `refresh_data` | Re-reads SDUI screen from DB for `params.module_id`, pushes `sdui_screen_update` |
| `submit_form` | Stores form submission in `ModuleState` keyed by `form_data__{form_id}`; sends notification; fires `FORM_SUBMITTED` trigger |
| `send_to_agent` | Fires `handle_chat_message()` as background task |
| `mark_notification_read` | Sets `is_read=True` on notification |
| `create_calendar_event` | Creates `CalendarEvent` ORM row |
| `delete_calendar_event` | Deletes `CalendarEvent` by `event_id` |
| `approve_draft` | Calls `tools.approve_draft()` |
| `reject_draft` | Calls `tools.reject_draft()` with optional `feedback` |

### `services/workflow_engine.py`

APScheduler (`AsyncIOScheduler(timezone="UTC")`)-based automation engine.

**TriggerType enum:** `EVENT_CREATED`, `EVENT_UPDATED`, `FORM_SUBMITTED`, `SCHEDULE` (cron string in `trigger_config.cron`), `MESSAGE_RECEIVED`

| Function | Purpose |
|----------|---------|
| `start_scheduler()` / `stop_scheduler()` | Lifecycle management |
| `_load_scheduled_workflows()` | On startup: re-registers all active SCHEDULE workflows |
| `_schedule_workflow(workflow)` | Registers/replaces APScheduler cron job (`misfire_grace_time=300`) |
| `fire_trigger(trigger_type, user_id, event_data)` | Called by routers when events occur; finds matching workflows |
| `register_workflow(workflow)` / `unregister_workflow(workflow_id)` | Called by workflow router after DB insert/delete |

### `services/audit.py`

| Function | Purpose |
|----------|---------|
| `log_audit(db, user_id, action, resource_type, resource_id, details?, ip_address?)` | Creates an `AuditLog` row. Wired into auth (login/logout/setup), calendar, workflows, notifications, modules, agent_config, users, sessions |

### `services/component_seed.py`

Seeds the `component_registry` table on startup with 11 default components:
- **7 Atomic:** Text, Markdown, Button, Image, TextInput, Icon, Divider
- **4 Hardcoded/Composite:** Container, CalendarModule, ChatModule, NotesModule

Only inserts if the component type doesn't already exist.

### `services/websocket_manager.py` (updated)

Added `ConnectionInfo` dataclass and `get_all_connections()` method for the admin WebSocket stats endpoint.

### `middleware/sandbox.py`

ASGI middleware that checks for `X-Helm-Sandbox: true` header. When active:
- Sets `sandbox_mode` context var in `database.py`
- `get_db()` intercepts `commit()` calls, recording them to `sandbox_actions` table instead
- Responses succeed but DB state is not permanently changed

---

## MCP Server & Tools

### `mcp/server.py`
- **Framework:** `FastMCP("Helm", streamable_http_path="/")`
- **Auth middleware:** `_MCPAuthMiddleware` validates Bearer token, sets `_current_user_id` context var
- **Mounted at:** `/mcp`

### MCP Tools (exposed to external agents via `/mcp`)

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `helm_read_calendar` | `start_date, end_date` (YYYY-MM-DD) | Get events in date range |
| `helm_create_event` | `title, start_time, end_time, description?, color?, location?` | Create event |
| `helm_update_event` | `event_id, title?, start_time?, end_time?, description?, color?, location?` | Update event |
| `helm_delete_event` | `event_id` | Delete one event |
| `helm_delete_all_events` | — | Delete ALL events for user (bulk) |
| `helm_read_all_calendar` | — | Get all events across all dates |
| `helm_send_notification` | `title, message, severity="info"` | Save notification + push WS event |
| `helm_get_chat_history` | `limit=20` | Get recent chat messages |
| `helm_send_chat_message` | `content` | Send assistant message + push `chat_complete` event |
| `helm_update_module_state` | `module_type, state` | Upsert module state + push `module_state_update` |
| `helm_get_form_data` | `form_id=""` | Get submitted form data |
| `helm_set_screen` | `module_id, screen` | Set SDUI screen; default draft=True |
| `helm_delete_screen` | `module_id` | Clear SDUI screen |
| `helm_list_screens` | — | List all AI-set screens |
| `helm_get_screen` | `module_id` | Get current SDUI JSON for a module |
| `helm_get_draft` | `module_id` | Get pending draft `{screen, has_draft}` for a module |
| `helm_approve_draft` | `module_id` | Promote draft to live |
| `helm_reject_draft` | `module_id, feedback?` | Discard pending draft with optional feedback |
| `helm_hide_tab` | `tab_id` | Hide a nav-bar tab |
| `helm_show_tab` | `tab_id` | Restore hidden tab |
| `helm_rename_tab` | `tab_id, name?, icon?` | Rename a tab and/or change its emoji icon |
| `helm_list_tabs` | — | List all tabs with visibility |

**Total: 22 MCP tools** (registered in `mcp/server.py` via `@mcp.tool()`). The Agent Proxy (`services/agent_proxy.py`) exposes a **16-tool subset** of these to the in-app LLM.

### `mcp/tools.py` — Core Tool Implementations

All tool logic is here; shared between the Agent Proxy (internal) and MCP Server (external). Accessed via `execute_tool(name, args, user_id)` dispatcher.

**Shared SDUI contract (`app/services/sdui_state.py` + `mcp/tools.py`):** `validate_sdui_screen_payload()` and `prepare_sdui_screen_for_storage()` centralize the save/apply contract used by REST validate/save, MCP `set_screen`, template apply/restore/duplicate flows, and draft approval. `normalize_sdui_screen()` still converts flat AI-generated component dicts to the props-based schema the frontend expects, while `_validate_sdui_v2()` enforces the row-first V2 contract when `rows` are present.

**Draft-cleared publish semantics:** `send_draft_cleared()` emits `sdui_draft_update` with `screen: null, version: 0` before the live update and still sends legacy `sdui_draft_rejected` for compatibility.

**Regression coverage:** `tests/test_sdui_parity.py` and `tests/test_templates.py` verify row-first validation/apply parity, agent-proxy/MCP tool-definition parity, live-only `list_screens`, draft-cleared publish sequencing, and assistant `message_id` reuse.

---

## `utils/security.py`

| Function | Purpose |
|----------|---------|
| `hash_password(password)` | bcrypt hash via passlib |
| `verify_password(plain, hashed)` | bcrypt verify |
| `create_access_token(subject, extra?)` | JWT HS256; expires in `access_token_expire_hours`; includes `sub`, `exp`, `type="access"`, `jti` (UUID for uniqueness) |
| `create_refresh_token(subject)` | JWT HS256; expires in `refresh_token_expire_days` |
| `decode_token(token)` | Decodes JWT; raises `JWTError` if invalid/expired |
| `get_subject_from_token(token)` | Returns `sub` claim or None |

---

## Python Dependencies (key packages)

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | ≥0.115 | Web framework |
| `uvicorn[standard]` | ≥0.34 | ASGI server |
| `sqlalchemy[asyncio]` | ≥2.0 | ORM + async engine |
| `aiosqlite` | ≥0.21 | Async SQLite driver |
| `alembic` | ≥1.15 | DB migrations |
| `pydantic` | ≥2.10 | Data validation |
| `pydantic-settings` | ≥2.7 | Config from `.env` |
| `python-jose[cryptography]` | ≥3.3 | JWT |
| `passlib[bcrypt]` | ≥1.7.4 | Password hashing |
| `bcrypt` | ≥3.2,<4.0 | (passlib incompatible with bcrypt≥4) |
| `httpx` | ≥0.28 | HTTP client for LLM calls, SSE |
| `mcp` | ≥1.6 | FastMCP framework |
| `apscheduler` | ≥3.11 | Cron/event scheduler |
| `loguru` | ≥0.7 | Logging |
| `python-dotenv` | ≥1.0 | `.env` loading |
