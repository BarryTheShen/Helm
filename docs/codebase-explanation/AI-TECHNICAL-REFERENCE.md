# Helm — AI Technical Reference

> **This file is for AI agents (Claude, Copilot, etc.) working on the Helm codebase.**
> Read this FIRST before making any changes. It tells you exactly where everything is,
> what connects to what, and what the known pitfalls are.

---

## Quick Orientation

Helm is a self-hosted AI super app with three layers:

| Layer | Tech | Location | Entry Point |
|-------|------|----------|------------|
| Backend | Python FastAPI | `backend/` | `backend/app/main.py` |
| Frontend | React Native (Expo) | `mobile/` | `mobile/index.ts` → `mobile/app/_layout.tsx` |
| Protocol | WebSocket + REST + MCP | Embedded in backend | `backend/app/routers/websocket.py` |

**To run backend:** `cd backend && uvicorn app.main:app --reload`
**To run frontend:** `cd mobile && npx expo start`
**To run tests:** `cd backend && pytest`
**To run standalone agent:** `source backend/.venv/bin/activate && cd agent && python helm_agent.py`

---

## File Map — Where to Find Things

### Backend (`backend/app/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| API endpoints | `routers/{domain}.py` | 8 router files |
| Database models | `models/{model}.py` | 9 model files, all import in `models/__init__.py` |
| Request/response types | `schemas/{domain}.py` | Exception: workflow schemas are inline in `routers/workflows.py` |
| Auth logic | `services/auth.py` + `utils/security.py` | Session-based with JWT tokens |
| AI chat streaming | `services/agent_proxy.py` | Core feature — LLM streaming + tool calls |
| WebSocket handling | `routers/websocket.py` + `services/websocket_manager.py` | Manager is singleton |
| MCP tools (for AI agents) | `mcp/tools.py` | Shared between agent proxy and MCP server |
| MCP server config | `mcp/server.py` | FastMCP wrapper, mounted at `/mcp` |
| Workflow automation | `services/workflow_engine.py` | APScheduler-based |
| App config | `config.py` | pydantic-settings, reads `.env` |
| Database engine | `database.py` | SQLAlchemy async, SQLite default |
| Auth dependencies | `dependencies.py` | `get_current_user`, `get_current_user_id` |
| DB migrations | `../alembic/versions/` | Run `alembic upgrade head` after model changes |

### Frontend (`mobile/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| Auth guard / routing | `app/_layout.tsx` | Redirects based on token presence |
| Auth screens | `app/(auth)/connect.tsx`, `app/(auth)/login.tsx` | |
| Tab screens | `app/(tabs)/{screen}.tsx` | 7 tabs: home, chat, modules, calendar, forms, alerts, settings |
| Tab bar config | `app/(tabs)/_layout.tsx` | Tab icons/labels; AI-controlled visibility via tabsStore |
| Home SDUI screen | `app/(tabs)/home.tsx` | Fully AI-driven via `useSDUIScreen('home')` |
| API calls | `src/services/api.ts` | `ApiClient` class with all endpoints |
| WebSocket client | `src/services/websocket.ts` | ReconnectingWebSocket wrapper |
| Auth service | `src/services/auth.ts` | Setup + login (pre-token) |
| Shared WS instance | `src/contexts/WebSocketContext.tsx` | Single WS shared across all tabs |
| SDUI screen hook | `src/hooks/useSDUIScreen.ts` | Fetch + live-update SDUI screen per module |
| SDUI renderer | `src/components/sdui/SDUIRenderer.tsx` | Component dispatch switch (19 types) |
| SDUI components | `src/components/sdui/*.tsx` | NOTE: AlertComponent, CalendarComponent, FormComponent, ListComponent are dead code — SDUIRenderer renders them inline |
| Common components | `src/components/common/*.tsx` | Button, Card, ErrorBanner, Input |
| Auth state | `src/stores/authStore.ts` | Token, serverUrl, user |
| UI state | `src/stores/uiStore.ts` | Connection status, error banner |
| Settings state | `src/stores/settingsStore.ts` | Nav mode, theme (both are stubs — not applied to UI) |
| Tab visibility state | `src/stores/tabsStore.ts` | hiddenTabs[], set by AI via WS or REST |
| Design tokens | `src/theme/colors.ts` | Colors, spacing, typography (dark mode defined but never applied) |
| API types | `src/types/api.ts` | TypeScript interfaces |
| SDUI types | `src/types/sdui.ts` | 19 component types, full action union |
| Validation schemas | `src/utils/validation.ts` | `wsMessageSchema` (uses `.passthrough()` — critical!); other schemas unused |
| Secure storage | `src/utils/storage.ts` | Platform-aware (SecureStore/localStorage) |

### Standalone Agent (`agent/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| Agent entry point / REPL | `agent/helm_agent.py` | Self-contained, no backend imports |
| Filesystem tool logic | `agent/helm_agent.py` (`read_frontend_file`, `write_frontend_file`, `list_frontend_files`) | Path-validated to `mobile/` |
| System prompt | `agent/helm_agent.py` (`system_prompt=` in `run_agent()` + `interactive_repl()`) | |
| Agent docs | `agent/README.md` | |

---

## Data Flow Diagrams

### Chat Message Flow (The Critical Path)

```
1. User types message in mobile/app/(tabs)/chat.tsx
2. chat.tsx calls wsRef.current.send({type: "chat_message", content: "...", conversation_id: "default"})
3. WebSocket handler (routers/websocket.py) receives message
4. Dispatches to services/agent_proxy.py handle_chat_message() as background task
5. Agent proxy:
   a. Loads AgentConfig from DB (API key, model, system prompt)
   b. Falls back to settings.openrouter_api_key if DB config has no key
   c. Loads last 20 ChatMessages from DB
   d. Saves user message to DB
   e. Sends "chat_start" via WebSocket
   f. Calls LLM streaming API (httpx POST to /chat/completions)
   g. For each token: sends "chat_token" via WebSocket {type: "chat_token", token: "..."}
   h. For tool calls: executes via mcp/tools.py
   i. Saves full assistant message to DB
   j. Sends "chat_complete" via WebSocket
6. chat.tsx.handleWebSocketMessage() receives events
   - wsMessageSchema uses .passthrough() so extra fields (token, message_id, etc.) are preserved
   - message.type === "chat_token" → appends message.token to assistant message
   - message.type === "chat_complete" → sets isTyping=false
```

### Authentication Flow

```
1. App launches → _layout.tsx checks authStore.token
2. No token → redirect to /(auth)/connect
3. User enters server URL + credentials → POST /auth/setup (creates user)
4. Redirect to /(auth)/login
5. User logs in → POST /auth/login → receives session_token
6. Token saved to SecureStore + authStore
7. Redirect to /(tabs)/chat
8. All API calls include Authorization: Bearer {token}
9. Backend validates token via dependencies.get_current_user()
   → Looks up Session where token matches, is_active=True, not expired
   → Returns User object
```

### SDUI Flow (How Dynamic UI Works)

```
1. User asks the AI in the chat tab (or standalone agent calls an MCP tool)
2. Agent proxy calls set_screen / delete_screen via mcp/tools.py
3. set_screen upserts ModuleState (key: "sdui__<module_id>") in DB, then sends:
   {type: "sdui_screen_update", module_id: "home", screen: {...}, version: N}
4. delete_screen removes ModuleState from DB, then sends:
   {type: "sdui_screen_update", module_id: "home", screen: null, version: 0}
5. Frontend receives event via shared WebSocketContext (WebSocketContext.tsx)
6. useSDUIScreen hook for that module_id calls setScreen(message.screen ?? null)
7. Tab screen re-renders: if screen !== null → SDUIScreenRenderer; else → default empty UI
```

All 7 tabs support SDUI override (home, chat, modules, calendar, forms, alerts, settings).
The home tab is fully AI-driven — it has no fallback UI other than an empty-state prompt.
SDUI actions (navigate, api_call, open_url, etc.) are typed and generated by AI but currently all log to console — not yet dispatched.

### Tab Visibility Flow (Live Hide/Show Tabs)

```
1. AI calls hide_tab / show_tab via MCP or agent proxy tool
2. mcp/tools.py updates _tabs_config module_state in DB
3. Sends {type: "tabs_updated", hidden: ["forms", "modules"]} via WS
4. Frontend tabs/_layout.tsx TabsConfigSync handler calls tabsStore.setHiddenTabs()
5. Tab items with href: null disappear from bottom tab bar immediately
```

---

## Database Schema Quick Reference

```sql
users           -- id, username, password_hash, role
devices         -- id, user_id, device_id, device_name, config_json, last_seen
sessions        -- id, user_id, device_id, token, expires_at, is_active
chat_messages   -- id, user_id, role, content, metadata_json
calendar_events -- id, user_id, title, start_time, end_time, description, color, location, is_all_day
notifications   -- id, user_id, title, message, severity, actions, is_read
workflows       -- id, user_id, name, trigger_type, trigger_config, action_config, is_active, run_count, last_run_at
agent_configs   -- id, user_id, provider, model, api_key_encrypted, base_url, system_prompt, temperature, max_tokens, is_active
module_states   -- id, user_id, module_type, state_json, version
```

All tables have: `created_at`, `updated_at` (auto-managed timestamps)
All IDs are UUID v4 strings (36 chars)
All user-owned tables have `user_id` FK to `users.id`

**`module_states` is a polymorphic key-value store.** Key naming conventions:
- `sdui__<module_id>` — AI-generated SDUI screen JSON (e.g. `sdui__home`, `sdui__chat`)
- `_tabs_config` — JSON list of hidden tab IDs
- `device_config` — device layout config (tab_bar_modules, default_module, nav_mode)
- `<module_id>` — module-specific state (e.g. `calendar`, `alerts`, `forms`)

---

## API Endpoint Quick Reference

| Method | Path | Auth | Router File |
|--------|------|------|-------------|
| GET | `/health` | No | `main.py` |
| GET | `/auth/status` | No | `routers/auth.py` |
| POST | `/auth/setup` | No | `routers/auth.py` |
| POST | `/auth/login` | No | `routers/auth.py` |
| POST | `/auth/refresh` | Yes | `routers/auth.py` |
| POST | `/auth/logout` | Yes | `routers/auth.py` |
| GET | `/api/calendar/events` | Yes | `routers/calendar.py` |
| POST | `/api/calendar/events` | Yes | `routers/calendar.py` |
| PUT | `/api/calendar/events/{id}` | Yes | `routers/calendar.py` |
| DELETE | `/api/calendar/events/{id}` | Yes | `routers/calendar.py` |
| GET | `/api/chat/history` | Yes | `routers/chat.py` |
| DELETE | `/api/chat/history` | Yes | `routers/chat.py` |
| GET | `/api/notifications` | Yes | `routers/notifications.py` |
| POST | `/api/notifications/{id}/read` | Yes | `routers/notifications.py` |
| POST | `/api/notifications/read-all` | Yes | `routers/notifications.py` |
| GET | `/api/workflows` | Yes | `routers/workflows.py` |
| POST | `/api/workflows` | Yes | `routers/workflows.py` |
| PUT | `/api/workflows/{id}` | Yes | `routers/workflows.py` |
| DELETE | `/api/workflows/{id}` | Yes | `routers/workflows.py` |
| GET | `/api/modules` | Yes | `routers/modules.py` |
| DELETE | `/api/modules/{id}` | Yes | `routers/modules.py` — hides tab |
| POST | `/api/modules/{id}/show` | Yes | `routers/modules.py` — shows tab |
| GET | `/api/modules/{id}/state` | Yes | `routers/modules.py` |
| POST | `/api/modules/{id}/action` | Yes | `routers/modules.py` — stub |
| GET | `/api/devices/config` | Yes | `routers/modules.py` |
| PUT | `/api/devices/config` | Yes | `routers/modules.py` |
| GET | `/api/sdui/{module_id}` | Yes | `routers/modules.py` — get AI screen |
| POST | `/api/sdui/{module_id}` | Yes | `routers/modules.py` — set AI screen |
| DELETE | `/api/sdui/{module_id}` | Yes | `routers/modules.py` — clear AI screen |
| GET | `/api/agent/config` | Yes | `routers/agent_config.py` |
| PUT | `/api/agent/config` | Yes | `routers/agent_config.py` |
| WS | `/ws?token=...` | Yes | `routers/websocket.py` |
| * | `/mcp/*` | Yes (Bearer) | `mcp/server.py` wrapped in `_MCPAuthMiddleware` |

---

## Known Bugs & Gotchas (CRITICAL — READ BEFORE EDITING)

### Frontend Issues

1. **`wsMessageSchema` MUST stay `.passthrough()`** — `wsMessageSchema` in `validation.ts` uses `.passthrough()` so all extra fields (token, message_id, content, etc.) from backend events are preserved after Zod validation. Without this, Zod strips unknown fields and token streaming breaks.

2. **SDUI actions never execute** — Every `onAction` handler in every tab screen is `(action) => console.log('[SDUI action]', action)`. Navigate, api_call, dismiss, open_sheet, copy_text, open_url actions are all typed and generated by the AI but silently dropped. **This is the single biggest unimplemented feature** after MVP.

3. **Four dead SDUI components** — `src/components/sdui/AlertComponent.tsx`, `CalendarComponent.tsx`, `FormComponent.tsx`, `ListComponent.tsx` are not imported by `SDUIRenderer.tsx` (it renders all types inline). They are dead code that duplicates logic.

4. **`navigation.ts` types unused** — `src/types/navigation.ts` has React Navigation param list types from an old navigation approach. Expo Router is used instead. Dead code.

5. **Most validation.ts schemas unused** — `calendarPropsSchema`, `formPropsSchema`, `alertPropsSchema` are defined and never called. Only `wsMessageSchema` is used.

6. **`settingsStore` settings have no effect** — `navigationMode` and `theme` are persisted but never applied to app UI. Dark mode is defined in `colors.ts` dark object but never switched to.

7. **`authStore.logout()` does not call backend** — Server sessions are never invalidated on logout from the frontend. The session remains active in the DB until it expires.

8. **Hardcoded development defaults in `connect.tsx`** — Pre-filled with `testuser`/`testpass123`/`localhost:8000`.

9. **`conversation_id: 'default'` hardcoded** — Throughout chat.tsx. No multi-conversation support.

10. **Tab order is fixed** — Home, Chat, Modules, Calendar, Forms, Alerts, Settings. AI can only hide/show tabs, not reorder them.

11. **`markNotificationRead` never called** — The API method exists in `api.ts` but alerts.tsx never calls it. Notifications can only be marked read via REST directly.

12. **Button accessibility** — `Button` component has `accessibilityRole="button"` so it renders as `<button>` in web. Without this, `TouchableOpacity` renders as `<div>` that browser automation and screen readers miss.

13. **`sduiComponentSchema` misses most types** — In `validation.ts`, the schema only covers a subset of SDUI types — missing `heading`, `container`, `stat`, `progress`, etc. Not used for rendering, but would fail to validate valid AI JSON if ever wired up.

### Backend Issues

14. **Refresh token creates broken session** — `routers/auth.py` refresh endpoint creates a new `Session` with `device_id=None`, breaking device tracking for that session.

15. **`fire_trigger()` never called** — Workflow triggers for events (`event_created`, `event_updated`, `form_submitted`, `message_received`) exist in the engine but no router calls `fire_trigger()`. Event-triggered workflows are completely non-functional.

16. **MCP user auth context** — `_current_user_id` ContextVar is set by `_MCPAuthMiddleware` correctly, but if any code path calls `get_current_user_id()` outside the MCP request lifecycle it returns an empty string. Not a live bug but worth being careful.

17. **Unread count is O(N) query** — `routers/notifications.py` fetches all notification scalars then runs `len()` to count unread. Not a problem at small scale but should be a COUNT query.

18. **CORS is fully open** (`allow_origins=["*"]`) in `main.py`. Fine for local/self-hosted, must be restricted for any public deployment.

19. **`api_key_encrypted` encryption key derivation** — The Fernet key is derived from `settings.secret_key` via SHA-256. Changing `SECRET_KEY` in `.env` makes all stored API keys irrecoverable (they decrypt to garbage). Back up the key.

20. **Workflow schemas inline in router** — `routers/workflows.py` defines `WorkflowCreate`, `WorkflowUpdate`, `WorkflowResponse` inline instead of in `app/schemas/`. Inconsistent with other domains.

21. **Chat history ignores `conversation_id`** — The `history` endpoint returns last 20 messages for the user regardless of conversation_id. Multi-conversation threading is not implemented.

### Model Selection Gotcha

22. **Reasoning model streaming** — The raw SSE loop in `agent_proxy.py` handles `delta.get("reasoning")` in addition to `delta.content`. This is required for DeepSeek-R1, QwQ, qwen3-thinking, stepfun models. Without it those models produce zero output.

23. **XML tool call fallback** — Some models (stepfun, others) emit `<tool_call>{"name":...,"arguments":...}</tool_call>` XML instead of OpenAI-standard function call JSON. `agent_proxy.py`’s `_parse_xml_tool_calls()` handles this. If you switch models and tool calls stop working, check if the model uses XML format.

24. **Free tier model rate limits** — OpenRouter free models get 429 if called too quickly. Wait 2–3 minutes, switch models, or add credit.

---

## Patterns to Follow When Adding Code

### Adding a New Backend Endpoint

1. If new table: Create model in `app/models/{name}.py`, add to `models/__init__.py`
2. Create schema in `app/schemas/{name}.py` (request + response Pydantic models)
3. Create router in `app/routers/{name}.py` with APIRouter
4. Register router in `app/main.py` (`app.include_router(...)`)
5. If new table: Create Alembic migration: `alembic revision --autogenerate -m "description"`
6. Write tests in `backend/tests/test_{name}.py`

### Adding a New MCP Tool

1. Implement the tool function in `app/mcp/tools.py`
2. Add it to the `handlers` dict in `execute_tool()`
3. Wrap it in `app/mcp/server.py` with `@mcp.tool()` decorator
4. If the agent proxy should call it: add to `_get_tool_definitions()` in `services/agent_proxy.py`

### Adding a New Frontend Screen (Tab)

1. Create file in `mobile/app/(tabs)/{name}.tsx`
2. Add tab in `mobile/app/(tabs)/_layout.tsx` (include in `tabHref` and `Tabs.Screen` list)
3. Add to `_ALL_TABS` constant in `backend/app/routers/modules.py`
4. Add to `_ALL_TAB_DETAILS` and `_ALL_TAB_IDS` in `backend/app/mcp/tools.py`
5. Add to `AVAILABLE_MODULES` if needed for REST listing
6. If it needs API data: add method to `src/services/api.ts`
7. If it needs types: add to `src/types/api.ts`
8. Add `useSDUIScreen('{name}')` call to the screen for AI override support

### Adding a New SDUI Component Type

1. Add the props interface to `src/types/sdui.ts` (extend `SDUIComponentType` union)
2. Add a case to `SDUIRenderer.tsx` `renderComponent()` switch
3. If the component handles user input: update `FormRenderer` for form-specific needs
4. Add the type to the MCP `helm_set_screen` docstring in `mcp/server.py` for AI awareness
5. Optionally add a Zod schema to `src/utils/validation.ts` (not required for rendering)

### Patterns Key Notes

- **Single WebSocket instance:** Never create a new `WebSocketService` in a tab screen — use `useWebSocket()` from `WebSocketContext.tsx`. Multiple connections cause duplicate messages.
- **SDUI override pattern:** Every tab screen checks `useSDUIScreen(moduleId)` first. If a screen is returned, render `SDUIScreenRenderer`. Otherwise render the default fallback UI.
- **Stale closure fix (chat.tsx):** The `wsHandlerRef` pattern — stable subscription defers to a ref that always holds the latest handler. Required when a handler needs to access mutable state.

---

## Dependency Versions (Pinned)

### Backend (Python 3.11+)
- FastAPI ≥0.115.0
- SQLAlchemy ≥2.0 (async)
- aiosqlite ≥0.21
- Alembic ≥1.15
- pydantic ≥2.10
- pydantic-settings ≥2.7
- python-jose (JWT)
- passlib + bcrypt <4.0 (compatibility)
- httpx ≥0.28
- mcp ≥1.6 (MCP server)
- APScheduler ≥3.11
- loguru ≥0.7

### Frontend (Node.js)
- Expo SDK 55
- React 19.2, React Native 0.83
- expo-router 55
- zustand 5.0
- reconnecting-websocket 4.4
- date-fns 4.1
- zod 4.3
- expo-secure-store 55

---

## Test Commands

```bash
# Backend
cd backend
pytest                      # Run all tests
pytest tests/test_auth.py   # Run specific test file
pytest -v                   # Verbose output
pytest --cov=app            # With coverage

# Frontend (no test suite yet — manual testing)
cd mobile
npx expo start --web        # Test in browser

# E2E
npx playwright test         # Requires backend + frontend running
```

---

## Environment Setup

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
cp .env.example .env  # Add your API keys
uvicorn app.main:app --reload

# Frontend
cd mobile
npm install
npx expo start
```

Required `.env` for backend:
```
# .env lives at repo root (Helm/.env), NOT at backend/.env
# config.py resolves its path absolutely: Path(__file__).parent.parent.parent / ".env"
DATABASE_URL=sqlite+aiosqlite:///./helm.db
SECRET_KEY=change-this-to-random-string

# OpenRouter (recommended — free tier available, 100+ models)
OPENROUTER_API_KEY=sk-or-v1-...       # Required for AI chat
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=stepfun/step-3.5-flash:free

# Both chat-tuned and reasoning/thinking models work.
# agent_proxy.py reads delta.reasoning as a fallback when delta.content is empty.

# OpenAI fallback (used only if openrouter_api_key is empty)
# OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o

# For MCP client scripts (expires after 24h)
HELM_SESSION_TOKEN=eyJ...
HELM_MCP_URL=http://localhost:8000/mcp/
```

---

## Architecture Decisions (Why Things Are This Way)

1. **SQLite not Postgres** — Single-user self-hosted app. SQLite is simpler, no server needed. Can migrate to Postgres later.
2. **Session tokens not stateless JWT** — Allows server-side invalidation (logout works immediately).
3. **SDUI not native screens** — The AI agent can dynamically update the UI by sending JSON. The app doesn't need updates to support new features.
4. **MCP + Agent Proxy** — Same tools work for both internal chat and external agents.
5. **Expo not bare React Native** — Faster development, easier build process, works on Linux for dev.
6. **Zustand not Redux** — Simpler, less boilerplate, perfect for this scale.
7. **APScheduler not Celery** — No message broker needed. Good enough for single-server deployment.
