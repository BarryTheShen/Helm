# Helm — Agentic AI Super App

An independent, open-source React Native (Expo) mobile app — a universal agentic AI frontend that dynamically renders rich native UI components connected to any service via APIs. WeChat/Alipay super app model but AI-native.

## Tech Stack

- **Frontend:** React Native (Expo), iOS-first, Android comes free
- **Backend:** Python FastAPI server, self-hosted
- **Protocol:** AG-UI over WebSocket (agent↔frontend communication)
- **AI Agent:** PydanticAI / raw LLM API calls
- **Dev Environment:** Linux (primary), Mac only for final App Store build
- **IDE:** Cursor

## Architecture (Three Layers)

1. **Backend** — Python FastAPI. API gateway, AI agent runtime, plugin/connector system for services (Google Calendar OAuth, weather, email, etc.)
2. **Protocol** — AG-UI protocol. Open-source, framework-agnostic message format. WebSocket transport. Backend sends AG-UI events → app parses and renders.
3. **React Native App** — SDUI renderer. Pre-built component library (calendar, chat, news feed, charts, forms, maps, notifications, lists). JSON payloads → native components.

**Build order:** Backend → Protocol → Frontend.

## Blueprint Spec Documents

Detailed production specifications live in `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/`:

- `Frontend Spec — iOS App (React Native : Expo).md` — SDUI renderer, navigation, component catalog, design system
- `Backend Spec — Python FastAPI Server.md` — API endpoints, database schema, MCP server, agent proxy, workflow engine
- `Protocol Spec — Communication Layer.md` — WebSocket, REST, OpenAI-compatible API, MCP, SDUI JSON schema, sequence diagrams

**Read all three specs before starting implementation. When making architectural decisions, consult these docs first.**

## Project Structure

```
Helm/
├── CLAUDE.md
├── backend/
│   ├── pyproject.toml          # Dependencies + pytest config
│   ├── alembic.ini
│   ├── alembic/                # DB migrations
│   ├── app/
│   │   ├── main.py             # FastAPI app factory, router registration, MCP mount
│   │   ├── config.py           # Pydantic Settings (.env support)
│   │   ├── database.py         # SQLAlchemy async engine + aiosqlite
│   │   ├── dependencies.py     # DI: get_current_user, get_db, get_token
│   │   ├── models/             # ORM models (User, Session, CalendarEvent, Workflow, Device, ChatMessage, AgentConfig)
│   │   ├── routers/            # FastAPI routers (auth, modules, chat, calendar, notifications, agent_config, workflows, websocket)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (auth, agent_proxy, websocket_manager, workflow_engine)
│   │   ├── mcp/                # MCP server (FastMCP) — tools.py + server.py
│   │   └── utils/              # JWT, security, encryption
│   └── tests/                  # pytest suite (32 tests passing)
├── mobile/                     # Expo / React Native
│   ├── app/
│   │   ├── _layout.tsx         # Root layout — auth gate, redirects unauthenticated → /(auth)/connect
│   │   ├── index.tsx           # Splash/redirect screen
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx     # Auth stack (no header)
│   │   │   ├── connect.tsx     # Server URL + first-user setup screen
│   │   │   └── login.tsx       # Login screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx     # Tab bar — HARDCODED tabs (not dynamic yet)
│   │       ├── chat.tsx        # Chat screen (WebSocket + API)
│   │       ├── calendar.tsx    # Calendar screen (API-driven)
│   │       ├── forms.tsx       # STUB — renders placeholder text only
│   │       ├── alerts.tsx      # Alerts/notifications screen
│   │       ├── modules.tsx     # Modules screen
│   │       └── settings.tsx    # Settings + logout
│   └── src/
│       ├── components/         # UI components (alerts, calendar, chat, common, forms, sdui, settings)
│       ├── services/
│       │   ├── api.ts          # ApiClient class — all REST calls, 401 auto-logout
│       │   ├── auth.ts         # AuthService — setup, login, logout
│       │   └── websocket.ts    # WebSocketService — ReconnectingWebSocket wrapper
│       ├── stores/
│       │   ├── authStore.ts    # Zustand — token, serverUrl, user; persisted via SecureStore/localStorage
│       │   ├── settingsStore.ts# Zustand — theme, agent config, navigation mode
│       │   └── uiStore.ts      # Zustand — error banner state
│       ├── theme/colors.ts     # Design system — colors, spacing, typography
│       ├── types/
│       │   ├── api.ts          # All API request/response TypeScript types
│       │   ├── navigation.ts   # Navigation param types
│       │   └── sdui.ts         # SDUI JSON schema types
│       └── utils/
│           ├── storage.ts      # Platform-aware: SecureStore (native) / localStorage (web)
│           └── validation.ts   # Input validation helpers
├── tests/
│   └── e2e.spec.ts             # Playwright E2E — 7 tests (4 backend API, 2 frontend, 1 integration)
├── playwright.config.ts        # Playwright config — starts backend (port 8000) + Expo web (port 8082)
└── docs/
    └── CODEBASE_MAP.md         # Detailed architecture map (auto-generated)
```

## Running the Project

```bash
# Backend
cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (web)
cd mobile && npx expo start --web --port 8082

# Backend tests
cd backend && .venv/bin/pytest

# E2E tests (requires both servers running or uses webServer config)
npx playwright test
```

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check → `{status, version}` |
| GET | /auth/status | No | Setup status → `{setup_complete, server_name, version}` |
| POST | /auth/setup | No | Create first user (409 if already done) |
| POST | /auth/login | No | Login → `{session_token, expires_at, user_id}` |
| POST | /auth/logout | Yes | Invalidate session |
| GET | /auth/me | Yes | Current user info |
| GET | /api/calendar/events | Yes | Query params: start_date, end_date |
| POST | /api/calendar/events | Yes | Create event |
| PUT | /api/calendar/events/{id} | Yes | Update event |
| DELETE | /api/calendar/events/{id} | Yes | Delete event |
| GET | /api/chat/messages | Yes | Chat history |
| POST | /api/chat/messages | Yes | Send message |
| GET | /api/notifications | Yes | List notifications |
| GET | /api/modules | Yes | Module list |
| GET | /api/devices/config | Yes | Tab bar config (not wired to frontend yet) |
| WS | /ws | Yes (token query param) | AG-UI WebSocket |
| * | /mcp | Yes (Bearer) | MCP server (Streamable HTTP) |

## Authentication Flow

```
User enters server URL + credentials → connect.tsx
→ POST /auth/setup (409 if already setup — treated as success, redirect to login)
→ Saved to SecureStore (native) or localStorage (web)
→ POST /auth/login → session_token
→ Token stored in authStore + SecureStore
→ ApiClient sends: Authorization: Bearer <token>
→ WebSocket connects with: ?token=<token>
→ Backend validates via get_session_by_token()
```

## MCP Server

- Mounted at `http://localhost:8000/mcp` via FastMCP (Streamable HTTP)
- Authentication: `Authorization: Bearer <session_token>`
- **Status: mounted but currently returns Internal Server Error at startup** (see `try/except` in main.py — error is swallowed silently)
- Tools exposed: `helm_read_calendar`, `helm_create_event`, `helm_update_event`, `helm_delete_event`, `helm_send_notification`, `helm_get_chat_history`, `helm_send_chat_message`, `helm_get_form_data`, `helm_update_module_state`
- To connect an AI agent: point it at `http://localhost:8000/mcp` with a bearer token

## WebSocket Protocol (AG-UI)

```
# Client → Backend
{"type": "chat", "data": {"message": "...", "conversation_id": "default"}}

# Backend → Client
{"type": "token", "data": {"content": "..."}}
{"type": "tool_call_start", "data": {"tool": "..."}}
{"type": "tool_call_complete", "data": {"result": ...}}
{"type": "chat_complete", "data": {"message_id": "..."}}
{"type": "module_state_update", "module": "calendar", "state": {<SDUI JSON>}}
```

## SDUI Rendering

Backend sends module state via WebSocket:
```json
{"type": "module_state_update", "module": "calendar", "state": {
  "type": "calendar",
  "id": "...",
  "props": { ... }
}}
```
Frontend `SDUIRenderer` switches on `type` → renders native component. User interactions call `onAction(action, data)` → sent back to backend.

## Key Patterns & Gotchas

- **TouchableOpacity vs View on web**: Use `TouchableOpacity` with `onPress` + `disabled` for all buttons. `View` with `onTouchEnd` does NOT fire on web mouse clicks.
- **TouchableOpacity renders as generic element on web**: `getByRole('button')` won't find it in Playwright. Use `getByText('Button Label')` instead.
- **auth/setup 409 = already setup**: Don't throw — return `{ already_setup: true }` and redirect to login. Already handled in `auth.ts`.
- **Storage is platform-aware**: `utils/storage.ts` uses `SecureStore` on native, `localStorage` on web. Never import SecureStore directly.
- **Tabs are hardcoded**: `app/(tabs)/_layout.tsx` has fixed tabs. Backend has `/api/devices/config` with `tab_bar_modules` but the frontend does NOT read it yet — tabs cannot be changed from the backend.
- **forms.tsx is a stub**: Renders placeholder text only. No logic implemented.
- **Default test credentials**: username `testuser`, password `testpass123` (pre-filled in connect.tsx for dev).
- **Playwright selectors**: When there are multiple elements with the same text (e.g. "Sign In" title + button), use `.last()` for the button — it's always the last match.

## Current Status & Known Issues

| Area | Status | Notes |
|------|--------|-------|
| Backend API | Working | 32 pytest tests passing |
| Auth flow (web) | Working | connect → setup → login → chat |
| Chat (WebSocket) | Working | Streaming tokens, tool calls |
| Calendar screen | Working | Fetches events from `/api/calendar/events` |
| Forms screen | Stub | Placeholder text only, no functionality |
| MCP server | Broken | Mounts with try/except but returns 500 at runtime |
| Dynamic tabs | Not wired | Backend has config endpoint, frontend ignores it |
| E2E tests | 7/7 passing | Run with `npx playwright test` |

## Development Workflow

- Run backend: `cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000`
- Run frontend: `cd mobile && npx expo start --web --port 8082`
- Run all E2E tests: `npx playwright test` (from project root)
- Run backend tests: `cd backend && .venv/bin/pytest`
- View test report: `npx playwright show-report`

## Code Style

- TypeScript strict mode on frontend
- All async operations use `async/await` (no `.then()` chains)
- Zustand for all global state — no React Context
- zod for runtime validation at system boundaries
- Backend: async SQLAlchemy everywhere, never sync
- All DB models extend `Base` + `TimestampMixin` (`created_at`, `updated_at`)
- FastAPI dependency injection via `Depends()` for db and auth

## When Writing Code

- Always write comments explaining PURPOSE (why it exists), not just what it does
- Update this CLAUDE.md when project structure changes, new commands are added, or new conventions are established
- Keep a CHANGELOG.md updated with every significant change
- When making architectural decisions, document the WHY in a comment or doc

## Important Rules

- NEVER commit directly to main — always branch and PR
- Keep commits atomic — one logical change per commit
- Commit messages: imperative mood, descriptive ("Add calendar component" not "added stuff")
- No console.log in committed code — use proper logging
- No hardcoded secrets, API keys, or URLs — use environment variables
- When in doubt, check the Blueprint specs in the project docs before making architectural decisions

## Common Mistakes to Avoid

- Do NOT use `View` + `onTouchEnd` for buttons — use `TouchableOpacity` + `onPress` (web compatibility)
- Do NOT use `getByRole('button')` in Playwright for React Native Web — use `getByText()`
- Do NOT throw on 409 from `/auth/setup` — treat it as success and redirect to login
- Do NOT import `SecureStore` directly — always go through `utils/storage.ts`
- Do NOT assume tabs are dynamic — they are hardcoded in `(tabs)/_layout.tsx` until that feature is built