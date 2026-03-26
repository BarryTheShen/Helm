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
| Tab screens | `app/(tabs)/{screen}.tsx` | 6 tabs: chat, modules, calendar, forms, alerts, settings |
| Tab bar config | `app/(tabs)/_layout.tsx` | Tab icons, labels, colors |
| API calls | `src/services/api.ts` | `ApiClient` class with all endpoints |
| WebSocket client | `src/services/websocket.ts` | ReconnectingWebSocket wrapper |
| Auth service | `src/services/auth.ts` | Setup + login (pre-token) |
| SDUI renderer | `src/components/sdui/SDUIRenderer.tsx` | Component dispatch switch |
| SDUI components | `src/components/sdui/*.tsx` | Calendar, Form, Alert, List |
| Common components | `src/components/common/*.tsx` | Button, Card, ErrorBanner, Input |
| Auth state | `src/stores/authStore.ts` | Token, serverUrl, user |
| UI state | `src/stores/uiStore.ts` | Connection status, error banner |
| Settings state | `src/stores/settingsStore.ts` | Nav mode, theme |
| Design tokens | `src/theme/colors.ts` | Colors, spacing, typography |
| API types | `src/types/api.ts` | TypeScript interfaces |
| SDUI types | `src/types/sdui.ts` | Component type definitions |
| Validation schemas | `src/utils/validation.ts` | Zod schemas |
| Secure storage | `src/utils/storage.ts` | Platform-aware (SecureStore/localStorage) |

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
1. AI agent calls update_module_state(module_type, state_json)
2. mcp/tools.py upserts ModuleState in DB
3. Sends WebSocket event: {type: "module_state_update", module: "calendar", state: {...}}
4. Frontend receives event (currently NOT handled in tab screens)
5. SDUIRenderer.tsx can render the state as native components
   ⚠️ NOTE: SDUIRenderer exists but isn't used in any tab screen yet
```

---

## Database Schema Quick Reference

```sql
users           -- id, username, password_hash, role
devices         -- id, user_id, device_id, device_name, config_json
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
| GET | `/api/modules/{id}/state` | Yes | `routers/modules.py` |
| POST | `/api/modules/{id}/action` | Yes | `routers/modules.py` |
| GET | `/api/devices/config` | Yes | `routers/modules.py` |
| PUT | `/api/devices/config` | Yes | `routers/modules.py` |
| GET | `/api/agent/config` | Yes | `routers/agent_config.py` |
| PUT | `/api/agent/config` | Yes | `routers/agent_config.py` |
| WS | `/ws?token=...` | Yes | `routers/websocket.py` |
| * | `/mcp/*` | Yes (Bearer) | `mcp/server.py` wrapped in `_MCPAuthMiddleware` |

---

## Known Bugs & Gotchas (CRITICAL — READ BEFORE EDITING)

### Frontend Issues

1. **Calendar query params — FIXED:** Frontend correctly sends `?start_date=...&end_date=...` matching backend.

2. **Notification field name — FIXED:** Frontend `Notification` type has `message` field, matching backend.

3. **WebSocket message schema** — `wsMessageSchema` in `validation.ts` uses `.passthrough()` so all extra fields (token, message_id, content, etc.) from backend events are preserved after Zod validation. Without this, Zod strips unknown fields and token streaming breaks.

4. **Button accessibility** — `Button` component has `accessibilityRole="button"` so it renders as a native `<button>` in web. Without this, `TouchableOpacity` renders as a `<div>` that browser automation and screen readers can't click reliably.

5. **SDUI renderer unused** — `SDUIRenderer.tsx` exists and works, but no tab screen imports or uses it. Tab screens hardcode their own rendering.

6. **Forms tab is empty** — Just a placeholder with static text.

7. **Dark mode not implemented** — Colors defined in `colors.ts` dark variant but not connected to any toggle.

8. **Module press handler is stub** — `console.log` only.

### Backend Issues

9. **API key stored as plaintext** — `AgentConfig.api_key_encrypted` is stored without encryption. `config.encryption_key` exists but isn't used.

10. **Refresh token creates broken session** — `routers/auth.py` refresh endpoint sets `device_id=None`, breaking device tracking.

11. **`fire_trigger()` never called** — Workflow triggers for events (event_created, form_submitted, etc.) exist in schema but no router calls `fire_trigger()`.

12. **Agent proxy tool call accumulation** — Streaming tool calls arrive in chunks. The code tries to parse `arguments` from individual deltas, but tool call arguments are accumulated across multiple chunks. Partial JSON parsing will fail.

### Model Selection Gotcha

13. **Do NOT use pure reasoning models** — Models like `stepfun/step-3.5-flash:free`, `qwen3-*`, `liquid/lfm-thinking` are reasoning-only: their `delta.content` is always empty string (all output in `delta.reasoning`), and they produce **zero output** when `tools` parameter is included. Always use a chat-tuned model. The current default is `arcee-ai/trinity-large-preview:free`.

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

### Adding a New Frontend Screen

1. Create file in `mobile/app/(tabs)/{name}.tsx`
2. Add tab in `mobile/app/(tabs)/_layout.tsx`
3. Add to module list in backend `routers/modules.py` AVAILABLE_MODULES
4. If it needs API data: add method to `src/services/api.ts`
5. If it needs types: add to `src/types/api.ts`

### Adding a New SDUI Component

1. Create component in `mobile/src/components/sdui/{Name}Component.tsx`
2. Add props interface to `src/types/sdui.ts`
3. Add case to `SDUIRenderer.tsx` switch
4. Add Zod schema to `src/utils/validation.ts`

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
OPENROUTER_MODEL=arcee-ai/trinity-large-preview:free

# IMPORTANT: Do NOT use pure reasoning models. They return empty content
# when tools are enabled (stepfun, qwen3:thinking, liquid/lfm-thinking, etc.)

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
