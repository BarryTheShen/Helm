# Helm — AI Technical Reference

> **This file is for AI agents (Claude, Copilot, etc.) working on the Helm codebase.**
> Read this FIRST before making any changes. It tells you exactly where everything is,
> what connects to what, and what the known pitfalls are.
>
> Last updated: 2026-03-30

---

## Quick Orientation

Helm is a self-hosted AI super app with three layers:

| Layer | Tech | Location | Entry Point |
|-------|------|----------|------------|
| Backend | Python FastAPI | `backend/` | `backend/app/main.py` |
| Frontend | React Native (Expo) | `mobile/` | `mobile/index.ts` → `mobile/app/_layout.tsx` |
| Protocol | WebSocket + REST + MCP | Embedded in backend | `backend/app/routers/websocket.py` |
| Standalone Agent | PydanticAI | `agent/` | `agent/helm_agent.py` |
| Keel Protocol | TypeScript | `packages/protocol/` | `packages/protocol/src/index.ts` |
| Keel Renderer | TypeScript / React Native | `packages/renderer/` | `packages/renderer/src/index.ts` |
| Keel Server | Python | `packages/server/` | `packages/server/keel_server/__init__.py` |
| Keel Demo App | TypeScript / Expo | `examples/keel-demo/` | `examples/keel-demo/src/App.tsx` |

**To run backend:** `cd backend && uvicorn app.main:app --reload`
**To run frontend:** `cd mobile && npx expo start`
**To run tests:** `cd backend && pytest`
**To run standalone agent:** `source backend/.venv/bin/activate && cd agent && python helm_agent.py`
**To run agent web UI:** `source backend/.venv/bin/activate && cd agent && python helm_agent.py --web`
**To run Keel tests:** `cd packages/protocol && npx jest` / `cd packages/renderer && npx jest` / `cd examples/keel-demo && npx jest`

---

## File Map — Where to Find Things

### Backend (`backend/app/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| API endpoints | `routers/{domain}.py` | 9 router files |
| Database models | `models/{model}.py` | 9 model files, all import in `models/__init__.py` |
| Request/response types | `schemas/{domain}.py` | Exception: workflow schemas are inline in `routers/workflows.py` |
| Auth logic | `services/auth.py` + `utils/security.py` | Session-based with JWT tokens |
| AI chat streaming | `services/agent_proxy.py` | Core feature — LLM streaming + tool calls + XML fallback |
| External agent routing | `services/agent_proxy.py` | When `settings.external_agent_url` is set, all chat is forwarded to `api_server.py` |
| WebSocket handling | `routers/websocket.py` + `services/websocket_manager.py` | token in query param; device_id tracked; `module_action` dispatches to action registry |
| Action handlers | `services/action_registry.py` | 8 named function handlers; add here to register new functions |
| Actions router | `routers/actions.py` | Actions whitelist (POST /api/actions/execute, GET /api/actions/functions); prevents SSRF |
| User management CLI | `manage.py` (backend root) | CLI user management (since /auth/setup is locked after first user) |
| MCP tools (for AI agents) | `mcp/tools.py` | Shared between agent proxy and MCP server |
| MCP server config | `mcp/server.py` | FastMCP wrapper, mounted at `/mcp` |
| Workflow automation | `services/workflow_engine.py` | APScheduler-based |
| App config | `config.py` | pydantic-settings, reads `.env` from repo root |
| Database engine | `database.py` | SQLAlchemy async, SQLite default |
| Auth dependencies | `dependencies.py` | `get_current_user`, `get_current_user_id` |
| DB migrations | `../alembic/versions/` | Run `alembic upgrade head` after model changes |
| SDUI module endpoints | `routers/modules.py` | `GET/POST/DELETE /api/sdui/{module_id}`, tabs management |

### Frontend (`mobile/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| Auth guard / routing | `app/_layout.tsx` | Redirects based on token presence |
| Auth screens | `app/(auth)/connect.tsx`, `app/(auth)/login.tsx` | Default URL: `http://localhost:9000` |
| Tab screens | `app/(tabs)/{screen}.tsx` | 7 tabs: home, chat, modules, calendar, forms, alerts, settings |
| Tab bar config | `app/(tabs)/_layout.tsx` | Tab icons/labels; AI-controlled visibility via tabsStore; TabsConfigSync here |
| Home SDUI screen | `app/(tabs)/home.tsx` | Fully AI-driven via `useSDUIScreen('home')` |
| Forms SDUI screen | `app/(tabs)/forms.tsx` | Purely SDUI — no fallback native UI |
| API calls | `src/services/api.ts` | `ApiClient` class with all endpoints |
| WebSocket client | `src/services/websocket.ts` | ReconnectingWebSocket wrapper (maxRetries=10, 30s ping) |
| Auth service | `src/services/auth.ts` | Setup + login (pre-token) |
| Shared WS instance | `src/contexts/WebSocketContext.tsx` | Single WS shared across all tabs |
| SDUI screen hook | `src/hooks/useSDUIScreen.ts` | Fetch + live-update SDUI screen per module; supports V1+V2 |
| Action dispatcher hook | `src/hooks/useActionDispatcher.ts` | Handles all SDUI action types (navigate, server_action, send_to_agent, etc.) |
| Breakpoint hook | `src/hooks/useBreakpoint.ts` | Returns `'compact'` or `'regular'` based on screen width (breakpoint: 768px) |
| SDUI renderer (V1+V2) | `src/components/sdui/SDUIRenderer.tsx` | V1 `SDUIScreenRenderer`, V2 `SDUIPageRenderer`, auto-dispatch `SDUIUniversalRenderer` |
| SDUI component registry (V2) | `src/renderer/componentRegistry.ts` | Type string → React component map; `registerComponent()` to extend |
| SDUI atomic components (V2) | `src/components/atomic/*.tsx` | SDUIText, SDUIMarkdown, SDUIButton, SDUIImage, SDUITextInput, SDUIIcon, SDUIDivider |
| SDUI structural components (V2) | `src/components/structural/SDUIContainer.tsx` | Flexbox container with shadow + color tokens |
| SDUI composite components (V2) | `src/components/composite/*.tsx` | CalendarModule, ChatModule, NotesModule, InputBar |
| SDUI V1 legacy components | `src/components/sdui/*.tsx` | AlertComponent, CalendarComponent, DraftPreview, FormComponent, ListComponent |
| Draft preview UI | `src/components/sdui/DraftPreview.tsx` | Approve/Reject/Feedback UI for pending SDUI drafts |
| Common components | `src/components/common/*.tsx` | Button, Card, ErrorBanner, Input |
| Auth state | `src/stores/authStore.ts` | Token, serverUrl, user |
| UI state | `src/stores/uiStore.ts` | Connection status, error banner |
| Settings state | `src/stores/settingsStore.ts` | Nav mode, theme (both stubs — not applied to UI) |
| Tab visibility state | `src/stores/tabsStore.ts` | hiddenTabs[], set by AI via WS or REST |
| Design tokens | `src/theme/colors.ts` | Colors, spacing, typography |
| Theme tokens (V2) | `src/theme/tokens.ts` | `themeColors`, `themeShadows`, `resolveColor()` |
| API types | `src/types/api.ts` | TypeScript interfaces for all backend responses |
| SDUI types | `src/types/sdui.ts` | V1 (19 component types, `SDUIScreen`) + V2 (`SDUIPage`, `SDUIRow`, `SDUICell`) |
| Navigation types | `src/types/navigation.ts` | Expo Router param lists |
| Validation schemas | `src/utils/validation.ts` | `wsMessageSchema` (uses `.passthrough()` — critical!) |
| Secure storage | `src/utils/storage.ts` | Platform-aware (SecureStore/localStorage) |
| Example dashboard template | `src/templates/dashboard-home.json` | Example V2 SDUIPage payload; not auto-loaded at runtime |

### Keel Framework (`packages/` and `examples/keel-demo/`)

Keel is the standalone SDUI protocol and toolkit. The Helm app (`mobile/`, `backend/`) is one example application built on the same concepts but maintains its own parallel implementations — it does not import from the Keel packages.

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| SDUI type definitions | `packages/protocol/src/types/sdui.ts` | SDUIPage, SDUIAction, SDUIComponentType, etc. |
| Zod validation schemas | `packages/protocol/src/schemas/validation.ts` | Validates SDUI payloads at runtime |
| Protocol barrel exports | `packages/protocol/src/index.ts` | Re-exports all types and schemas |
| Component registry | `packages/renderer/src/registry/componentRegistry.ts` | registerComponent(), resolveComponent() |
| Preset system | `packages/renderer/src/registry/presets.ts` | registerPreset() for UI library adapters |
| Built-in components | `packages/renderer/src/components/*.ts` | Text, Button, Container, etc. |
| Paper preset | `packages/renderer/src/presets/paper.tsx` | React Native Paper adapter components |
| Renderer barrel exports | `packages/renderer/src/index.ts` | Re-exports registry, components, presets |
| Python MCP factory | `packages/server/keel_server/__init__.py` | create_mcp_server(), ConnectionManager |
| Demo app | `examples/keel-demo/src/App.tsx` | Runnable Expo app with Paper preset |
| Demo screen data | `examples/keel-demo/src/screens.ts` | Home and calendar screen JSON |
| Demo custom component | `examples/keel-demo/src/WeatherWidget.ts` | Example third-party component |

### Standalone Agent (`agent/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| Agent entry point / REPL | `agent/helm_agent.py` | Self-contained, no backend imports |
| Agent web UI + API server | `agent/api_server.py` | Starlette SSE server; serves `chat_ui.html`; used as external agent by backend |
| Chat web UI | `agent/chat_ui.html` | Self-contained dark-themed chat UI; handles SSE from pydantic-ai API |
| Filesystem tool logic | `agent/helm_agent.py` | `read_frontend_file`, `write_frontend_file`, `list_frontend_files` — path-validated to `mobile/` |
| System prompt | `agent/helm_agent.py` (`_SYSTEM_PROMPT`) | SDUI V2 schema, all module IDs, action types |
| One-shot prompt CLI | `agent/send_prompt.py` | CLI tool to POST a message to `api_server.py /api/run` and print the streamed response |
| Agent docs | `agent/README.md` | |

---

## Data Flow Diagrams

### Chat Message Flow (The Critical Path)

```
1. User types message in mobile/app/(tabs)/chat.tsx
2. chat.tsx calls ws.send({type: "chat_message", content: "...", conversation_id: "default"})
3. WebSocket handler (routers/websocket.py) receives message
4. Dispatches to services/agent_proxy.py handle_chat_message() as background task
5. Agent proxy:
   a. If settings.external_agent_url set → POST to EXTERNAL_AGENT_URL/api/run → SSE relay
   b. Else built-in path:
      - Loads AgentConfig from DB (API key Fernet-decrypted, model, system prompt)
      - Falls back to settings.openrouter_api_key / openai_api_key if no DB config
      - Loads last 21 ChatMessages from DB
      - Saves user message to DB
      - Sends {type: "chat_start", message_id: <uuid>} to frontend via WS
      - Makes streaming POST to LLM /chat/completions
      - For each text delta: sends {type: "chat_token", message_id, token}
      - If delta.tool_calls: accumulates by index → executes after stream ends
      - If <tool_call> XML in response → strips XML, sends chat_message_replace
      - For each tool call: calls execute_tool() in mcp/tools.py
        → sends {type: "tool_result", tool, result}
      - Loops back to LLM with tool results (max 5 turns)
      - Saves final assistant message to DB
      - Sends {type: "chat_complete", message_id, content}
```

### SDUI Update Flow

```
Agent calls helm_set_screen(module_id, screen, draft=True)   [default]
  → tools.py normalize_sdui_screen() → stores as "sdui__{module_id}__draft" in module_states
  → broadcasts {type: "sdui_draft_update", module_id, screen, version}
  → Frontend useSDUIScreen() receives → sets draft state → shows DraftPreview component

User clicks "Approve"
  → POST /api/actions/execute {function: "approve_draft", params: {module_id: "home"}}
  → action_registry._approve_draft() → tools.py approve_draft()
  → copies draft to live "sdui__{module_id}" record, deletes draft record
  → broadcasts {type: "sdui_screen_update", module_id, screen, version}
  → Frontend replaces draft preview with live screen

User clicks "Reject"
  → POST /api/actions/execute {function: "reject_draft", params: {module_id: "home"}}
  → tools.py reject_draft() → deletes draft record
  → broadcasts {type: "sdui_draft_rejected", module_id}
  → Frontend clears draft state
```

### Action Dispatch Flow (SDUI `server_action`)

```
User taps a button in SDUI → SDUIRenderer calls onAction("server_action", {function, params})
  → useActionDispatcher() hook → ApiClient.executeAction(function, params)
  → POST /api/actions/execute {function, params}
  → action_registry.execute(name, user_id, params, db)
  → named handler (submit_form, send_to_agent, create_calendar_event, etc.)
```

---

## Known Bugs / Issues

| # | File | Description | Impact |
|---|------|-------------|--------|
| 1 | `backend/app/main.py` | `_run_time_alerts()` calls `manager.connected_users()` but `ConnectionManager` only has `connected_user_ids` (property, not method). Time-alert background task crashes every 2 minutes with `AttributeError`. | Background periodic notifications broken |
| 2 | `backend/app/mcp/server.py` | `helm_hide_tab` MCP tool not registered — body appears at module level after premature return in `helm_approve_draft`. Tab hiding is unavailable from external MCP clients. Agent proxy `hide_tab` works fine (calls `tools.py` directly). | MCP `helm_hide_tab` broken |
| 3 | `backend/app/routers/calendar.py` | `update_event()` function defined but has no `@router.put(...)` decorator — endpoint is unreachable via REST. | `PUT /api/calendar/events/{id}` → 404 |

---

## Critical Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| All DB models use UUID string PKs | `models/*.py` | Consistent; use `str(uuid4())` as default |
| Auth is session-based | `sessions` table + `dependencies.py` | JWT token validated server-side every request |
| MCP tools shared between proxy+server | `mcp/tools.py` + `execute_tool()` | Single source of truth for all tool logic |
| Frontend state: Zustand | `src/stores/*.ts` | 4 stores: auth, ui, settings, tabs |
| Frontend routing: Expo Router | `app/` file-based | `(auth)/` and `(tabs)/` groups |
| WS message validation: Zod `.passthrough()` | `utils/validation.ts` | Never strip unknown fields from backend! |
| SDUI V2 (preferred) | `SDUIPage` with rows+cells | Responsive, compositional; use PascalCase component types |
| SDUI V1 (legacy) | `SDUIScreen` with sections | Still supported; lowercase component types |
| Draft workflow | `sdui__X__draft` in module_states | AI always sets drafts first (default); user approves |
| XML tool-call fallback | `agent_proxy._parse_xml_tool_calls()` | Supports stepfun and other non-function-calling models |

---

## Port Map

| Service | Default Port | How to change |
|---------|-------------|---------------|
| Backend FastAPI | `9000` | `SERVER_PORT` in `.env` |
| Standalone agent web UI / api_server | `7860` | `AGENT_WEB_PORT` in `.env` or `--port` CLI arg |
| WebSocket | Same as backend (`9000`) | `ws://host:9000/ws?token=...` |
| MCP endpoint | Same as backend (`9000`) | `http://host:9000/mcp/` |

---

## Environment Variables (`.env` at Repo Root)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./helm.db` | DB connection |
| `SECRET_KEY` | `dev-secret-key-change-in-production` | JWT signing |
| `ENCRYPTION_KEY` | `` | Fernet key for API key encryption |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `720` | 30-day token lifetimes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token lifetime |
| `SERVER_HOST` | `0.0.0.0` | Bind address |
| `SERVER_PORT` | `9000` | Port |
| `OPENAI_API_KEY` | `` | OpenAI key (fallback) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI endpoint |
| `OPENAI_MODEL` | `gpt-4o` | Fallback model |
| `OPENROUTER_API_KEY` | `` | Primary LLM key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter endpoint |
| `OPENROUTER_MODEL` | `stepfun/step-3.5-flash:free` | Model for agent proxy + standalone agent |
| `MCP_PATH` | `/mcp` | MCP server mount path |
| `EXTERNAL_AGENT_URL` | `` | If set, all mobile chat forwarded to `{URL}/api/run` |
| `HELM_SESSION_TOKEN` | `` | Used by standalone agent to auth to MCP |
| `AGENT_WEB_PORT` | `7860` | Port for `helm_agent.py --web` and `api_server.py` |
| `HELM_MCP_URL` | `http://localhost:9000/mcp/` | MCP URL used by standalone agent |

---

## Root-Level Dev & Test Scripts

These files live at the repo root and are **not** part of the production app — they are development and debugging utilities.

### Root-Level Package & Config

| File | Purpose |
|------|---------|
| `package.json` | Installs Playwright + Puppeteer for root-level JS test scripts (separate from `mobile/package.json`) |
| `playwright.config.ts` | Playwright config for `tests/e2e.spec.ts`; targets frontend at port 8082; auto-starts backend |

### Python Dev Scripts

| File | Purpose |
|------|---------|
| `inject-home.py` | One-shot script to push a sample Wandr/Tokyo SDUI V2 home screen directly via REST (bypasses the draft/approval flow) |
| `test_mcp_agent.py` | MCP integration test: verifies connectivity, pydantic-ai agent via MCP, and auth rejection |
| `test-full-flow.sh` | Bash smoke test: checks backend health, auth endpoint, and frontend rendering via `curl` |

### Playwright / Puppeteer Exploration Scripts

Ad-hoc scripts written during SDUI development sessions. **Not integrated into CI.** Some require updating hardcoded tokens before use.

| File | Purpose |
|------|---------|
| `test-all-buttons.js` | Comprehensive SDUI button test across all 4 tabs — all action types (navigate, open_url, copy_text, send_to_agent, server_action) |
| `test-buttons.js` | Minimal single-button navigate smoke test |
| `test-diag.js` | Polls the home tab for 10 s, prints buttons and page text; exits when SDUI loads |
| `test-diag2.js` | Dumps all buttons and visible text across all 4 tabs for diagnostics |
| `test-frontend.js` | Puppeteer smoke test; takes screenshot at `/tmp/frontend-screenshot.png` |
| `test-openurl.js` | Verifies `open_url` action fires `window.open` with the correct URL |
| `helm-live-test.js` | Full live-app test: login, tabs, screenshots, REST API checks |
| `helm-sdui-test.js` | SDUI V1-format integration test (all 7 tabs, persistence, WS-delete) |
| `helm-sdui-test2.js` | SDUI V2-format integration test (improved version of the above, correct row/cell schema) |
