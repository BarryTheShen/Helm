# Helm Codebase Map
 
> Live tree snapshot: 2026-06-18
> Scope: backend/, mobile/, web/, qa/, agent/, debug/, docs/
 
## Read this first
 
1. [docs/codebase-explanation/README.md](codebase-explanation/README.md) — docs index and reading order.
2. [docs/codebase-explanation/OPERATIONS.md](codebase-explanation/OPERATIONS.md) — how to run and configure the stack.
3. [docs/codebase-explanation/backend.md](codebase-explanation/backend.md) — backend layer map.
4. [docs/codebase-explanation/frontend.md](codebase-explanation/frontend.md) — frontend layer map for the mobile app and web admin.
5. [docs/codebase-explanation/protocol.md](codebase-explanation/protocol.md) — REST, WebSocket, MCP, and SDUI contracts.
6. [docs/codebase-explanation/qa.md](codebase-explanation/qa.md) — Playwright coverage and test layout.
7. [docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md](codebase-explanation/AI-TECHNICAL-REFERENCE.md) — fast lookup for AI agents.
 
## Project Overview
 
Helm is an agentic AI super app. The live repo is split across backend, mobile, web, qa, agent, debug, and docs.
 
```text
Helm/
├── backend/                  # FastAPI backend
│   ├── alembic/              # DB migrations
│   ├── app/                  # API wiring, models, routers, schemas, services
│   └── tests/                # 34 test modules
├── mobile/                   # Expo / React Native app
│   ├── app/                  # Router-driven screens
│   └── src/                  # components, hooks, services, stores, utils
├── web/                      # React + Vite admin panel
│   └── src/                  # editor, pages, components, hooks, stores, lib
├── qa/                       # 33 Playwright spec files plus support code
├── agent/                    # standalone PydanticAI agent
├── debug/                    # trace and smoke-test helpers
├── docs/                     # docs index and codebase maps
├── AGENTS.md
├── CLAUDE.md
├── docker-compose.yml
├── package.json
└── setup.sh
```
 
**Status**: Updated against the live tree on 2026-06-18. Backend test modules: 34. QA spec files: 33. Backend registry: 29 routers, 34 model files, 31 schema files, 23 service modules. Web admin runs from `web/`; mobile uses Expo.
 
---
 
## Backend

### Entry Point

**[backend/app/main.py](../backend/app/main.py)**
- FastAPI app with async lifespan (starts/stops APScheduler)
- CORS: allow all origins (dev)
- Health check: `GET /health`
- Registers the current router set from `backend/app/main.py`; see [backend.md](codebase-explanation/backend.md) for the full live router list.
- Mounts MCP server at `/mcp` via FastMCP `streamable_http_app`
- Logging: loguru

**[backend/app/config.py](../backend/app/config.py)**
- Pydantic Settings with `.env` support
- Key settings: `DATABASE_URL` (SQLite), `SECRET_KEY`, `ENCRYPTION_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`

**[backend/app/database.py](../backend/app/database.py)**
- SQLAlchemy async engine + aiosqlite
- `AsyncSessionLocal` (no autoflush/autocommit)
- `get_db()`: yields session, auto-commit on success, rollback on error

**[backend/app/dependencies.py](../backend/app/dependencies.py)**
- `get_current_user()`: HTTPBearer → validates session token → returns User
- `get_current_user_id()`: returns user ID string
- `get_token_from_request()`: extracts Bearer token

---

### Models

All models extend `Base` + `TimestampMixin` (`created_at`, `updated_at`).

| Model | File | Key Fields | Notes |
|-------|------|-----------|-------|
| User | [models/user.py](../backend/app/models/user.py) | id (UUID), username, password_hash, role | All relationships cascade delete-orphan |
| Session | [models/session.py](../backend/app/models/session.py) | token (unique, indexed), expires_at, is_active, device_id | Session-backed auth token |
| CalendarEvent | [models/calendar_event.py](../backend/app/models/calendar_event.py) | title, start_time, end_time, color, is_all_day | Indexed on user_id + start_time |
| Workflow | [models/workflow.py](../backend/app/models/workflow.py) | trigger_type (enum), trigger_config (JSON), action_config (JSON), run_count, last_run_at | TriggerType: EVENT_CREATED, SCHEDULE, etc. |
| Device | [models/device.py](../backend/app/models/device.py) | device_id, push_token | For push notifications |
| ChatMessage | [models/chat_message.py](../backend/app/models/chat_message.py) | role, content, tokens_used | Conversation history |
| Notification | [models/notification.py](../backend/app/models/notification.py) | title, body, read_at | Read/unread state |
| AgentConfig | [models/agent_config.py](../backend/app/models/agent_config.py) | system_prompt, model_config | One-to-one with User |
| ModuleState | [models/module_state.py](../backend/app/models/module_state.py) | module_name, state (JSON) | Per-user module persistence |

---

### Routers

| Router | File | Base Path | Key Endpoints |
|--------|------|-----------|---------------|
| auth | [routers/auth.py](../backend/app/routers/auth.py) | `/auth` | POST /setup, /login, /logout, /refresh |
| calendar | [routers/calendar.py](../backend/app/routers/calendar.py) | `/calendar` | CRUD events |
| chat | [routers/chat.py](../backend/app/routers/chat.py) | `/chat` | GET history, DELETE |
| notifications | [routers/notifications.py](../backend/app/routers/notifications.py) | `/notifications` | GET, mark-read |
| workflows | [routers/workflows.py](../backend/app/routers/workflows.py) | `/workflows` | CRUD + manual trigger |
| modules | [routers/modules.py](../backend/app/routers/modules.py) | `/modules` | Module state CRUD |
| agent_config | [routers/agent_config.py](../backend/app/routers/agent_config.py) | `/agent-config` | GET/PUT agent settings |
| websocket | [routers/websocket.py](../backend/app/routers/websocket.py) | `/ws` | `WS /ws/{user_id}` AG-UI stream |

---

### Services

**[services/auth.py](../backend/app/services/auth.py)**
- `is_setup_complete()` — checks if any user exists (first-run gate)
- `create_first_user()` — creates admin with hashed password
- `authenticate_user()` — bcrypt verify + session token creation
- `get_session_by_token()` — used by auth dependency

**[services/agent_proxy.py](../backend/app/services/agent_proxy.py)**
- Core of the AI interaction layer
- `AgentProxy`: wraps OpenAI-compatible client
- Receives user messages, streams AG-UI events back over WebSocket
- Integrates MCP tools; function calling loop with tool execution
- Maintains conversation history via ChatMessage model
- AG-UI event types: `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`, `TOOL_CALL_RESULT`, `RUN_FINISHED`

**[services/websocket_manager.py](../backend/app/services/websocket_manager.py)**
- `ConnectionManager`: manages per-user WebSocket connections
- `connect()` / `disconnect()` / `broadcast_to_user()`
- Serializes AG-UI events to JSON for transport

**[services/workflow_engine.py](../backend/app/services/workflow_engine.py)** (inferred from models)
- APScheduler-backed workflow execution
- Handles trigger types: SCHEDULE, EVENT_CREATED, FORM_SUBMITTED, MESSAGE_RECEIVED
- Updates `run_count` and `last_run_at` on execution
- Errors logged but don't disable workflows

---

### MCP Server

**[mcp/server.py](../backend/app/mcp/server.py)** + **[mcp/tools.py](../backend/app/mcp/tools.py)**
- FastMCP instance mounted at `/mcp`
- Exposes internal Helm data as MCP tools for the AI agent
- Tools include: calendar operations, workflow management, notification creation, module state reads
- Agent can self-modify app state through tool calls

---

### Utils

**[utils/](../backend/app/utils/)** — session-token auth, bcrypt password hashing, Fernet encryption for sensitive fields

---

### Database Migrations

**[alembic/versions/](../backend/alembic/versions/)**
- `de71aeb133e3_initial_schema.py` — full schema creation
- `d4aa5857b012_add_run_count_and_last_run_at_to_.py` — adds workflow tracking fields

---

## Frontend

### Routing (Expo Router)

```
mobile/app/
├── index.tsx          # Expo Router entry
├── _layout.tsx        # Root: auth gate, store init
├── launchpad.tsx      # App launchpad
├── unassigned.tsx     # Unassigned modules
├── (auth)/
│   ├── connect.tsx      # Server URL input
│   └── login.tsx        # Username/password
├── (tabs)/
│   ├── _layout.tsx      # Tab bar (6 tabs)
│   ├── home.tsx         # AI-driven home screen
│   ├── chat.tsx         # Chat interface
│   ├── modules.tsx      # Module grid
│   ├── calendar.tsx     # Calendar view
│   ├── forms.tsx        # Form submissions
│   ├── alerts.tsx       # Notifications
│   ├── article.tsx      # Article reader
│   └── settings.tsx     # User settings
├── template/
│   └── [id].tsx         # Template detail/apply screen
└── module/
    └── [moduleId].tsx   # Custom module runtime + draft approval
```

**Auth Flow**: `connect` → `login` → `(tabs)/chat`

---

### State Management (Zustand)

| Store | File | State | Persistence |
|-------|------|-------|-------------|
| authStore | [stores/authStore.ts](../mobile/src/stores/authStore.ts) | token, user, serverUrl, isLoading | SecureStore |
| settingsStore | [stores/settingsStore.ts](../mobile/src/stores/settingsStore.ts) | navigationMode, theme | AsyncStorage |

---

### Services

**[services/api.ts](../mobile/src/services/api.ts)**
- `ApiClient` class: wraps fetch with baseUrl, token, error handling
- Methods: login, logout, healthCheck, calendar CRUD, notifications, workflows, modules, chat history
- Throws `ApiError` on non-2xx; calls `onUnauthorized()` on 401

**[services/websocket.ts](../mobile/src/services/websocket.ts)**
- `WebSocketService`: wraps ReconnectingWebSocket
- Token passed as query param: `ws://host/ws?token=...`
- Heartbeat: ping every 30s
- Message validation: zod schema
- Event handlers: `onMessage()`, `onConnect()`, `onDisconnect()`

---

### Components

**Common** ([components/common/](../mobile/src/components/common/))
- Button, Card, Input, ErrorBanner
- Theme colors from `@/theme/colors`

**SDUI Renderer** ([components/sdui/SDUIRenderer.tsx](../mobile/src/components/sdui/SDUIRenderer.tsx))
- Main renderer: switches on `component.type`
- Supported: calendar, form, alert, list, card, text, button
- Stubs: image, chart, map
- Recursive rendering for nested components
- `onAction` callback for user interactions

**SDUI Types** ([types/sdui.ts](../mobile/src/types/sdui.ts))
- `SDUIComponent`: type, id, props, children
- Component types: calendar, form, alert, list, card, chart, map, text, image, button

---

### Screens

**Chat** ([app/(tabs)/chat.tsx](../mobile/app/(tabs)/chat.tsx))
- Initializes ApiClient + WebSocketService
- Loads chat history via API
- Connects to WebSocket, listens for `token`, `tool_call_start`, `tool_call_complete`
- Sends: `{"type": "chat", "data": {"message": ..., "conversation_id": "default"}}`
- Renders messages in FlatList, typing indicator
- KeyboardAvoidingView for iOS

**Settings** ([app/(tabs)/settings.tsx](../mobile/app/(tabs)/settings.tsx))
- Displays server URL, agent config, navigation mode, theme, version, username
- Logout button with confirmation

**Connect** ([app/(auth)/connect.tsx](../mobile/app/(auth)/connect.tsx))
- Server URL input
- Health check verification
- Saves URL to SecureStore

---

### Configuration

**[mobile/app.json](../mobile/app.json)** — Expo config
**[mobile/package.json](../mobile/package.json)** — Dependencies: React Native, Expo, Zustand, zod, ReconnectingWebSocket

---

## Data Flow

### Authentication
```
User enters URL → connect.tsx → saves to SecureStore
User logs in → login.tsx → POST /auth/login → session_token
Token saved to SecureStore + authStore
ApiClient uses token in Authorization header
WebSocket connects with token as query param
Backend validates via get_session_by_token() → returns User
```

### Chat (WebSocket)
```
User sends message → chat.tsx → ws.send({"type": "chat", ...})
Backend websocket.py → agent_proxy.handle_chat_message()
Agent loads config, history, calls LLM API (streaming)
Streams tokens back: ws.send({"type": "chat_token", ...})
Frontend appends tokens to last assistant message
Tool calls: agent executes via mcp/tools.py, sends tool_result
Final message persisted to DB, chat_complete sent
```

### SDUI Rendering
```
Backend sends: {"type": "module_state_update", "module": "calendar", "state": {...}}
Frontend receives via WebSocket
State contains SDUI JSON: {"type": "calendar", "id": "...", "props": {...}}
SDUIRenderer switches on type, renders native component
User interaction → onAction(action, data) → sends back to backend
```

### Workflow Execution
```
Event occurs (e.g., calendar event created) → router calls workflow_engine.fire_trigger()
Engine queries DB for matching workflows (trigger_type, user_id, is_active)
For each workflow: _execute_workflow() → calls mcp/tools.execute_tool()
Tool executes (e.g., send_notification), updates DB, pushes via WebSocket
Workflow run_count incremented, last_run_at updated
```

---

## Key Patterns

- **Dependency Injection**: FastAPI Depends() for db, auth
- **Async/Await**: All DB, HTTP, WebSocket operations
- **Session Management**: Session tokens stored with expiry and validated server-side
- **Multi-device Support**: ConnectionManager maps user_id → list[WebSocket]
- **Tool Execution**: Shared dispatcher for agent proxy + MCP server
- **SDUI Protocol**: Backend sends JSON definitions, frontend renders natively
- **Workflow Engine**: APScheduler for scheduled, event-driven for triggers
- **State Persistence**: Zustand + SecureStore (auth) + AsyncStorage (settings)

---

## Gotchas & Important Notes

### Backend
- **bcrypt version**: Must use `<4.0.0` for passlib compatibility
- **CalendarEvent field**: Model uses `is_all_day`, not `all_day`
- **Login response**: Returns `session_token`, not `access_token`
- **Auth router prefix**: `/auth`, not `/api/auth`
- **MCP API**: Use `mcp.streamable_http_app`, not `mcp.get_asgi_app()`
- **Workflow fields**: `run_count` and `last_run_at` added in migration `d4aa5857b012`
- **WebSocket auth**: Token passed as query param, not header
- **No GET-by-ID**: Calendar events and workflows only have list/create/update/delete

### Frontend
- **Token persistence**: SecureStore (not AsyncStorage) for auth tokens
- **WebSocket token**: Passed as query param `?token=...`
- **SDUI types**: Renderer switches on `component.type`, stubs for unimplemented types
- **Theme colors**: Imported from `@/theme/colors`, not hardcoded

---

## Testing
 
**Backend**: 34 backend test modules in `backend/tests/`; pytest uses in-memory SQLite and the `get_db` dependency override
- Fixtures: `auth_client` (pre-authenticated), `db_engine` (fresh DB per test)
 
**QA**: 33 Playwright spec files in `qa/src/tests/` across the `backend-only` and `e2e` projects
- Backend API tests work without browser
- Browser tests need: `sudo npx playwright install-deps chromium`
- Config: [qa/playwright.config.ts](../qa/playwright.config.ts)

---

## Navigation Guide

### To add a new API endpoint
1. Create schema in `backend/app/schemas/`
2. Create router in `backend/app/routers/` or add to existing
3. Mount in `backend/app/main.py`
4. Add tests in `backend/tests/`

### To add a new database model
1. Create model in `backend/app/models/`
2. Import in `backend/app/models/__init__.py`
3. Create Alembic migration: `alembic revision --autogenerate -m "..."`
4. Run: `alembic upgrade head`

### To add a new screen
1. Create file in `mobile/app/(tabs)/` or `mobile/app/(auth)/`
2. Use ApiClient for data fetching
3. Connect to WebSocket if real-time needed
4. Use SDUI renderer for backend-driven UI

### To add a new component
1. Create the component in the right family (`mobile/src/components/atomic/`, `composite/`, `structural/`, `sdui/`, or `common/`).
2. Register it in `mobile/src/renderer/componentRegistry.ts` if SDUI should render it.
3. Use theme colors from `@/theme/colors`.
4. Add SDUI types if backend-driven.

### To modify auth flow
1. Backend: `backend/app/services/auth.py` + `backend/app/routers/auth.py`
2. Frontend: `mobile/app/(auth)/` screens + `mobile/src/stores/authStore.ts`
3. Update session token handling in ApiClient + WebSocket

### To add a new workflow trigger
1. Add TriggerType enum value in `backend/app/models/workflow.py`
2. Call `workflow_engine.fire_trigger()` from relevant router
3. Add tests in `backend/tests/test_workflows.py`

---

## Commands
 
```bash
# Backend
cd backend
.venv/bin/python -m pytest tests/ -q          # Run tests
uv run uvicorn app.main:app --reload          # Dev server
 
# Frontend
cd mobile
npx expo start                                 # Dev server (port 8082)
npx expo start --ios                          # iOS simulator (Mac only)
npx expo start --android                      # Android emulator
 
# Database
cd backend
.venv/bin/alembic upgrade head                # Apply migrations
.venv/bin/alembic revision --autogenerate -m "..." # Create migration
 
# QA
cd qa
npm run test                                   # Full Playwright suite
npm run test:backend                           # Backend-only project
```

---

## Other top-level folders

### Web Admin (`web/`)

- Entry point: `web/src/App.tsx`
- Pages: `web/src/pages/*.tsx` — Login, Settings, Templates, Editor, App Editor, Workflows, Variables, Connections, Logs
- Editor surface: `web/src/editor/*`
- Shared helpers: `web/src/lib/api.ts`, `web/src/hooks/useResource.ts`, `web/src/stores/authStore.ts`
- Use [frontend.md](codebase-explanation/frontend.md) and [AI-TECHNICAL-REFERENCE.md](codebase-explanation/AI-TECHNICAL-REFERENCE.md) for the full web-admin path map.

### QA (`qa/`)

- Playwright config: `qa/playwright.config.ts`
- Spec files: `qa/src/tests/*.spec.ts` — 33 test files
- Startup / teardown: `qa/src/globalSetup.cjs`, `qa/src/globalTeardown.cjs`
- Discovery: `qa/src/discover.cjs`
- Fixtures and helpers: `qa/src/fixtures.ts`, `qa/src/utils.ts`, `qa/src/page-objects/*.ts`

### Agent (`agent/`)

- Entry points: `agent/helm_agent.py`, `agent/api_server.py`
- Chat UI: `agent/chat_ui.html`
- CLI: `agent/send_prompt.py`

### Debug (`debug/`)

- Trace helpers: `debug/trace_*.py`
- Notes: `debug/README.md`

---

## Key Files Summary

### Backend Core
- [backend/app/main.py](../backend/app/main.py) — Entry point
- [backend/app/config.py](../backend/app/config.py) — Settings
- [backend/app/database.py](../backend/app/database.py) — DB setup
- [backend/app/dependencies.py](../backend/app/dependencies.py) — DI

### Backend Services
- [backend/app/services/auth.py](../backend/app/services/auth.py) — Auth logic
- [backend/app/services/agent_proxy.py](../backend/app/services/agent_proxy.py) — AI integration
- [backend/app/services/websocket_manager.py](../backend/app/services/websocket_manager.py) — WebSocket
- [backend/app/services/workflow_engine.py](../backend/app/services/workflow_engine.py) — Workflows

### Frontend Core
- [mobile/app/_layout.tsx](../mobile/app/_layout.tsx) — Root layout
- [mobile/app/(tabs)/_layout.tsx](../mobile/app/(tabs)/_layout.tsx) — Tab navigation
- [mobile/app/(tabs)/chat.tsx](../mobile/app/(tabs)/chat.tsx) — Chat screen
- [mobile/src/services/api.ts](../mobile/src/services/api.ts) — API client
- [mobile/src/services/websocket.ts](../mobile/src/services/websocket.ts) — WebSocket client
- [mobile/src/components/sdui/SDUIRenderer.tsx](../mobile/src/components/sdui/SDUIRenderer.tsx) — SDUI renderer