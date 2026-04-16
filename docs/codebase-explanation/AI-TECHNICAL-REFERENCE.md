# Helm — AI Technical Reference

> **This file is for AI agents (Claude, Copilot, etc.) working on the Helm codebase.**
> Read this FIRST before making any changes. It tells you exactly where everything is,
> what connects to what, and what the known pitfalls are.
>
> Last updated: 2026-04-16
> Last audit: 2026-04-16 — ✅ PRODUCTION-READY (200/200 backend tests passing, web admin fully functional)

---

## Quick Orientation

Helm is a self-hosted AI super app with three layers:

| Layer | Tech | Location | Entry Point |
|-------|------|----------|------------|
| Backend | Python FastAPI | `backend/` | `backend/app/main.py` |
| Frontend | React Native (Expo) | `mobile/` | `mobile/index.ts` → `mobile/app/_layout.tsx` |
| Web Admin | React + Vite + Tailwind | `web/` | `web/src/main.tsx` |
| Protocol | WebSocket + REST + MCP | Embedded in backend | `backend/app/routers/websocket.py` |
| Standalone Agent | PydanticAI | `agent/` | `agent/helm_agent.py` |

**To run backend:** `cd backend && uvicorn app.main:app --reload`
**To run frontend:** `cd mobile && npx expo start`
**To run web admin:** `cd web && npm run dev`
**To run tests:** `cd backend && pytest`
**To run standalone agent:** `source backend/.venv/bin/activate && cd agent && python helm_agent.py`
**To run agent web UI:** `source backend/.venv/bin/activate && cd agent && python helm_agent.py --web`

---

## File Map — Where to Find Things

### Backend (`backend/app/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| API endpoints | `routers/{domain}.py` | 18 router files |
| Database models | `models/{model}.py` | 18 model files, all import in `models/__init__.py` |
| Request/response types | `schemas/{domain}.py` | 16 schema files (includes trigger.py); workflow schemas inline in `routers/workflows.py` |
| Auth logic | `services/auth.py` + `utils/security.py` | Session-based with JWT tokens |
| Admin-only guard | `dependencies.py::require_admin` | Raises 403 if `user.role != "admin"` |
| AI chat streaming | `services/agent_proxy.py` | Core feature — LLM streaming + tool calls + XML fallback |
| External agent routing | `services/agent_proxy.py` | When `settings.external_agent_url` is set, all chat is forwarded to `api_server.py` |
| WebSocket handling | `routers/websocket.py` + `services/websocket_manager.py` | token in query param; device_id tracked; `module_action` dispatches to action registry |
| Action handlers | `services/action_registry.py` | 25 named function handlers (9 server-side + 16 client-only stubs); add here to register new functions |
| Actions router | `routers/actions.py` | Actions whitelist (POST /api/actions/execute, GET /api/actions/functions); prevents SSRF |
| User management CLI | `manage.py` (backend root) | CLI user management (since /auth/setup is locked after first user) |
| MCP tools (for AI agents) | `mcp/tools.py` | Shared between agent proxy and MCP server |
| MCP server config | `mcp/server.py` | FastMCP wrapper, mounted at `/mcp` |
| Workflow automation | `services/workflow_engine.py` | APScheduler-based |
| Variable resolver | `services/variable_resolver.py` | Resolves `{{expression}}` syntax; scopes: user.*, component.*.value, self.value, custom.*, env.*, data.*.* |
| Trigger engine | `services/trigger_engine.py` | `fire_trigger()` executes action chains from TriggerDefinition records |
| Trigger model | `models/trigger.py` | TriggerDefinition ORM model (schedule/data_change/server_event) |
| Trigger schemas | `schemas/trigger.py` | TriggerCreate, TriggerUpdate, TriggerOut |
| Trigger CRUD router | `routers/triggers.py` | CRUD + test endpoint for trigger definitions |
| App config | `config.py` | pydantic-settings, reads `.env` from repo root |
| Database engine | `database.py` | SQLAlchemy async, SQLite default |
| Auth dependencies | `dependencies.py` | `get_current_user`, `get_current_user_id`, `require_admin`, `PaginationParams` |
| DB migrations | `../alembic/versions/` | Run `alembic upgrade head` after model changes |
| SDUI module endpoints | `routers/modules.py` | `GET/POST/DELETE /api/sdui/{module_id}`, tabs management, screen history, validate, duplicate |
| SDUI regression tests | `../tests/test_sdui_parity.py` + `../tests/test_templates.py` | Covers row-first validate/apply parity, draft-cleared publish sequencing, proxy tool defs, and streamed `message_id` reuse |
| User management (admin) | `routers/users.py` | CRUD + list, all admin-only |
| Session management | `routers/sessions.py` | List (admin/mine), revoke, revoke-others |
| Audit log | `routers/audit.py` | Admin list + my list |
| Component registry | `routers/components.py` | CRUD for SDUI component definitions |
| SDUI templates | `routers/templates.py` | CRUD + apply + import + rows |
| Admin stats | `routers/admin.py` | System stats, workflow stats, WebSocket stats |
| Audit service | `services/audit.py` | `log_audit()` helper — wired into auth, calendar, workflows, etc. |
| Component seed | `services/component_seed.py` | Seeds 11 default components (7 atomic + 4 hardcoded) |
| Sandbox middleware | `middleware/sandbox.py` | ASGI middleware; `X-Helm-Sandbox` header → intercepts DB commits |
| Sandbox DB support | `database.py` | `contextvars sandbox_mode`; `get_db` intercepts commits in sandbox mode |

### Frontend (`mobile/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| Auth guard / routing | `app/_layout.tsx` | Redirects based on token presence |
| Auth screens | `app/(auth)/connect.tsx`, `app/(auth)/login.tsx` | Default URL: `http://localhost:8000` |
| Tab screens | `app/(tabs)/{screen}.tsx` | 7 built-in tabs: home, chat, modules, calendar, forms, alerts, settings |
| Modules launcher | `app/(tabs)/modules.tsx` | Built-ins jump to tab routes; custom modules open `/module/[moduleId]`; list labels built-in vs custom |
| Custom module route | `app/module/[moduleId].tsx` | Dedicated runtime route for non-built-in modules; uses `useSDUIScreen(moduleId)` + `DraftPreview` approval flow |
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
| SDUI renderer (V1+V2) | `src/components/sdui/SDUIRenderer.tsx` | V1 `SDUIScreenRenderer`, V2 `SDUIPageRenderer`, auto-dispatch `SDUIUniversalRenderer`; V2 rows honor per-side padding with `padding` as fallback; rows with fixed height apply `overflow: 'hidden'` to prevent calendar-type content bleed |
| SDUI component registry (V2) | `src/renderer/componentRegistry.ts` | Type string → React component map; `registerComponent()` to extend |
| SDUI atomic components (V2) | `src/components/atomic/*.tsx` | SDUIText, SDUIMarkdown, SDUIButton, SDUIImage, SDUITextInput, SDUIIcon, SDUIDivider (indent + margin aware) |
| SDUI structural components (V2) | `src/components/structural/SDUIContainer.tsx` | Flexbox container with shadow + color tokens |
| SDUI composite components (V2) | `src/components/composite/*.tsx` | CalendarModule, ChatModule, NotesModule, InputBar |
| SDUI V1 legacy components | `src/components/sdui/*.tsx` | AlertComponent, CalendarComponent, DraftPreview, FormComponent, ListComponent |
| Draft preview UI | `src/components/sdui/DraftPreview.tsx` | Approve/Reject/Feedback UI for pending SDUI drafts |
| Common components | `src/components/common/*.tsx` | Button, Card, ErrorBanner, Input |
| Auth state | `src/stores/authStore.ts` | Token, serverUrl, user |
| UI state | `src/stores/uiStore.ts` | Connection status, error banner |
| Settings state | `src/stores/settingsStore.ts` | Nav mode, theme (both stubs — not applied to UI) |
| Tab visibility state | `src/stores/tabsStore.ts` | hiddenTabs[], set by AI via WS or REST |
| Variable context hook | `src/hooks/useVariableContext.ts` | Assembles VariableContext from auth store, component state, and custom vars (fetched from backend) |
| Variable resolver | `src/utils/variableResolver.ts` | Resolves `{{expression}}` mustache templates with NOT_FOUND sentinel; `resolveAllExpressions()` for deep objects |
| Design tokens | `src/theme/colors.ts` | Colors, spacing, typography |
| Theme tokens (V2) | `src/theme/tokens.ts` | `themeColors`, `themeShadows`, `resolveColor()` |
| API types | `src/types/api.ts` | TypeScript interfaces for all backend responses |
| SDUI types | `src/types/sdui.ts` | V1 (19 component types, `SDUIScreen`) + V2 (`SDUIPage`, `SDUIRow`, `SDUICell`) |
| Navigation types | `src/types/navigation.ts` | Expo Router param lists |
| Validation schemas | `src/utils/validation.ts` | `wsMessageSchema` (uses `.passthrough()` — critical!) |
| Secure storage | `src/utils/storage.ts` | Platform-aware (SecureStore/localStorage) |
| Example dashboard template | `src/templates/dashboard-home.json` | Example V2 SDUIPage payload; not auto-loaded at runtime |

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

### Web Admin Panel (`web/`)

| Need to change... | Edit this file | Notes |
|-------------------|---------------|-------|
| App entry / routing | `web/src/App.tsx` | React Router; login guard; `AdminLayout` wrapper |
| Login page | `web/src/pages/LoginPage.tsx` | Authenticates against backend `/auth/login` |
| Dashboard (stats) | `web/src/pages/DashboardPage.tsx` | Admin stats from `/api/admin/stats` |
| User management | `web/src/pages/UsersPage.tsx` | CRUD via `/api/users` |
| Session management | `web/src/pages/SessionsPage.tsx` | List + revoke via `/api/sessions` |
| Audit log viewer | `web/src/pages/AuditPage.tsx` | Filterable list from `/api/audit` |
| Workflow management | `web/src/pages/WorkflowsPage.tsx` | Manage workflows |
| SDUI template management | `web/src/pages/TemplatesPage.tsx` | CRUD + import/export templates |
| Component registry | `web/src/pages/ComponentsPage.tsx` | View/edit registered SDUI components |
| Variables & Data Sources | `web/src/pages/VariablesPage.tsx` | Two-tab page: Variables CRUD + Data Sources management |
| Actions & Triggers | `web/src/pages/ActionsTriggersPage.tsx` | Two-tab page: Action catalog (hardcoded) + Trigger CRUD with test |
| Rule builder | `web/src/editor/RuleBuilder.tsx` | Notion-style visual rule builder for action chains on interactive components |
| Visual SDUI editor | `web/src/pages/EditorPage.tsx` | Custom 3-panel editor: structure tree + template library, draft save/push-live flow, presets + custom device sizes, JSON view/import, undo/redo, status bar (shows actual `deviceWidth`×`deviceHeight` from Zustand store), destructive unsaved-change confirmations, live+draft loading that prefers drafts, surfaced module/screen load errors, delete-screen gating on persisted-or-draft state, legacy V1 section-title normalization into heading rows, V1 import that preserves vertical section stacks by emitting one row per legacy component, read-only preservation of lowercase legacy runtime payloads including legacy forms, and module CRUD (create/delete custom modules) |
| Editor types & presets | `web/src/editor/types.ts` | EditorRow/Cell/Screen types, row visual props, DevicePresets (10 presets), ComponentRegistry, authorable component filtering, `server_action` param validation before persistence, ActionRule/ActionStep types, `rules` field on EditorCell |
| Local template library | `web/src/editor/templateLibrary.ts` | Built-in starter screen templates + reusable row templates shown in the left panel, aligned to live runtime props |
| Component prop schemas | `web/src/editor/componentSchemas.ts` | Per-component property schemas for dynamic form generation in PropertyInspector; only supported authorable actions are offered for new edits, while imported unsupported actions fall back to generic editable fields |
| Editor state (Zustand) | `web/src/editor/useEditorStore.ts` | Rows-first editor contract: rows, selection, history/historyIndex, device dimensions/orientation, screen load/apply/get helpers, row/cell/component mutators, `updateCellRules()` method |
| Structure tree (left panel) | `web/src/editor/StructureTree.tsx` | Screen root item + expandable rows/cells with CRUD, row reorder, and JSON copy actions |
| Editor canvas (center panel) | `web/src/editor/EditorCanvas.tsx` | Interactive canvas with component previews, stable multi-step row drag (50px threshold, 300ms debounce), cell resize handles, direct row-height resize, add-row controls, row boundary visibility (dashed borders, alternating backgrounds) |
| Property inspector (right) | `web/src/editor/PropertyInspector.tsx` | Tabbed UI (Properties/Rules) for interactive components; contextual editor for row height, cell count/widths, background, per-side padding, scrollable rows, component props/actions |
| Component picker | `web/src/editor/ComponentPicker.tsx` | Component type selection popover, grouped by category, using authorable registry entries only |
| SDUI adapter (legacy) | `web/src/lib/sduiAdapter.ts` | Legacy normalization helper retained from the old editor; not used by the current custom editor |
| Puck config (deprecated) | `web/src/lib/puckConfig.tsx` | Delete-stub only — current editor does not import it |
| API client | `web/src/lib/api.ts` | Typed fetch wrapper for all admin endpoints; the global 401 handler can be suppressed per request |
| Utilities | `web/src/lib/utils.ts` | Shared helpers |
| Auth store | `web/src/stores/authStore.ts` | Zustand store for admin auth state; `/auth/login` suppresses the global unauthorized handler so expected 401s do not clear the session |
| Nav layout | `web/src/components/AdminLayout.tsx` | Sidebar navigation + top bar |
| Tailwind styles | `web/src/index.css` | Global Tailwind CSS |
| Vite config | `web/vite.config.ts` | Dev server + build config |

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
  → services/sdui_state.py prepare_sdui_screen_for_storage() validates the shared save/apply contract
  → stores as "sdui__{module_id}__draft" in module_states
  → broadcasts {type: "sdui_draft_update", module_id, screen, version}
  → Frontend useSDUIScreen() receives → sets draft state → shows DraftPreview component

User clicks "Approve"
  → POST /api/actions/execute {function: "approve_draft", params: {module_id: "home"}}
  → action_registry._approve_draft() → tools.py approve_draft()
  → persist_live_screen() copies draft to live "sdui__{module_id}" record and clears draft row
  → broadcasts {type: "sdui_draft_update", module_id, screen: null, version: 0}
  → broadcasts legacy {type: "sdui_draft_rejected", module_id}
  → broadcasts {type: "sdui_screen_update", module_id, screen, version}
  → Frontend clears draft state and replaces the preview with the live screen

User clicks "Reject"
  → POST /api/actions/execute {function: "reject_draft", params: {module_id: "home"}}
  → tools.py reject_draft() → deletes draft record
  → broadcasts {type: "sdui_draft_update", module_id, screen: null, version: 0}
  → broadcasts legacy {type: "sdui_draft_rejected", module_id}
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

## Test Coverage

**Last Test Run:** 2026-04-16  
**Status:** ✅ 200/200 tests passing (100% pass rate)  
**Execution Time:** 117 seconds

### Test Breakdown by Module

| Module | Tests | Status |
|--------|-------|--------|
| Actions | 19 | ✅ |
| Admin | 7 | ✅ |
| Auth | 13 | ✅ |
| Calendar | 9 | ✅ |
| Data Sources | 16 | ✅ |
| Drafts | 18 | ✅ |
| Modules | 14 | ✅ |
| Notifications | 8 | ✅ |
| Sandbox | 10 | ✅ |
| SDUI Parity | 30 | ✅ |
| Sessions | 10 | ✅ |
| Templates | 18 | ✅ |
| Triggers | 8 | ✅ |
| Users | 11 | ✅ |
| Variable Resolver | 5 | ✅ |
| Variables | 8 | ✅ |
| Workflows | 13 | ✅ |

### Coverage Gaps

The following areas lack automated tests:
- Frontend (React Native) — no test suite exists
- Web Admin Panel — no test suite exists
- Standalone Agent — no test suite exists
- MCP Server — no integration tests
- WebSocket real-time behavior — no live connection tests
- End-to-end workflows — no Playwright/Cypress tests

---

## Known Gaps / Outstanding Work

The following **incomplete features and known issues** exist:

| # | Area | Status | Description |
|---|------|--------|-------------|
| 1 | Frontend | Not tested | Calendar tab is read-only — no create/edit/delete UI in the frontend |
| 2 | Frontend | Not tested | `conversation_id: 'default'` is hardcoded — no multi-conversation support |
| 3 | Frontend | Not tested | `settingsStore.navigationMode` and `.theme` are persisted but neither value is applied to the UI |
| 4 | Frontend | Not tested | Four legacy V1 SDUI component files (`AlertComponent.tsx`, `CalendarComponent.tsx`, `FormComponent.tsx`, `ListComponent.tsx`) — exist but only used for V1 rendering |
| 5 | Backend | ✅ Tested | `trigger_engine.register_scheduled_triggers()` is a placeholder — TriggerDefinition schedule triggers must be manually tested via the test endpoint |
| 6 | Backend | ✅ Tested | `TriggerType.DATA_CHANGED` and `SERVER_EVENT` exist in the enum but the Workflows page dropdown only shows 5 types (missing those two) |
| 7 | Backend | ✅ Tested | `demo_time_alerts=True` by default — broadcasts time notifications every 2 minutes in production unless explicitly disabled |
| 8 | Web | Not tested | `web/src/lib/sduiAdapter.ts` — dead code (legacy Puck stub, retained but unused) |
| 9 | Agent | ⚠️ Issue | `send_prompt.py` requires a manually set session token; no automated auth flow |
| 10 | Agent | ⚠️ Issue | Standalone agent uses `claude-opus-4-20250514` which hits rate limits; should use `claude-sonnet-4-20250514` instead |

### Recent Fixes (2026-04-16)

- ✅ Agent error handling improved — now shows actionable error messages instead of generic "Agent error occurred"
- ✅ Web admin port corrected in documentation (5174, not 5173)
- ✅ All 200 backend tests verified passing

---

## Critical Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| All DB models use UUID string PKs | `models/*.py` | Consistent; use `str(uuid4())` as default |
| Auth is session-based | `sessions` table + `dependencies.py` | JWT token validated server-side every request |
| MCP tools shared between proxy+server | `mcp/tools.py` + `execute_tool()` | Single source of truth for all tool logic |
| Frontend state: Zustand | `src/stores/*.ts` | 4 stores: auth, ui, settings, tabs |
| Frontend routing: Expo Router | `app/` file-based | `(auth)/` and `(tabs)/` groups |
| Web Admin state: Zustand | `web/src/stores/authStore.ts` | Single auth store; pages are self-contained |
| Web Admin routing: React Router | `web/src/App.tsx` | Login guard; sidebar nav via `AdminLayout` |
| Custom web editor | `web/src/pages/EditorPage.tsx` + `web/src/editor/*` | Three-panel SDUI editor with a rows-first store contract, structure tree + template library, direct canvas resize controls, row visual props, draft save/push-live flow, JSON view/import, unsaved-change confirmations on destructive paths, legacy V1 section-title normalization, V1 import that preserves vertical section stacks, read-only preservation of lowercase legacy runtime payloads including legacy forms, constrained authoring for supported actions/components, and module CRUD (create/delete custom modules) |
| Module CRUD (dynamic modules) | `backend/app/routers/modules.py` + `web/src/pages/EditorPage.tsx` | Users can create custom modules (name + icon → slug ID) and delete them; custom modules stored as `_custom_modules` key in `module_states`; `GET /api/sdui/modules` returns `is_custom` flag |
| Local editor templates | `web/src/editor/templateLibrary.ts` | Starter screens and row templates keep the left panel useful when saved templates are empty or supplemental |
| Pagination pattern | `dependencies.py::PaginationParams` | `skip`, `limit`, `search` — used by workflows, notifications, calendar, audit |
| Bulk delete pattern | `DELETE /api/{resource}/bulk` | JSON body `{ids: [...]}` — calendar, notifications, workflows |
| Audit logging | `services/audit.py::log_audit()` | Wired into auth, calendar, workflows, notifications, modules, agent_config, users, sessions |
| Sandbox mode | `middleware/sandbox.py` + `database.py` | `X-Helm-Sandbox: true` header → DB commits intercepted, recorded |
| Admin-only endpoints | `dependencies.py::require_admin` | Raises 403 for non-admin users |
| WS message validation: Zod `.passthrough()` | `utils/validation.ts` | Never strip unknown fields from backend! |
| SDUI V2 (preferred) | `SDUIPage` with rows+cells | Responsive, compositional; use PascalCase component types |
| SDUI V1 (legacy) | `SDUIScreen` with sections | Still supported; lowercase component types |
| V2 schema validation | `mcp/tools.py::_validate_sdui_v2()` | Server-side validation of component types against `_VALID_V2_COMPONENT_TYPES` frozenset; raises ValueError with actionable message for external agents |
| Draft workflow | `sdui__X__draft` in module_states | AI always sets drafts first (default); user approves |
| Module CRUD | `routers/modules.py` | Custom modules stored as `_custom_modules` in `module_states`; built-in modules cannot be deleted; custom module deletion also cleans up SDUI data |
| Modules tab launcher | `mobile/app/(tabs)/modules.tsx` + `mobile/app/module/[moduleId].tsx` | Built-ins navigate to their tab route; custom modules open a dedicated SDUI route with the same draft approval UX |
| Draft-cleared contract | `services/sdui_state.py` + `src/hooks/useSDUIScreen.ts` | Clearing or replacing a draft emits `sdui_draft_update` with `screen: null, version: 0`; legacy `sdui_draft_rejected` still follows for compatibility |
| Web admin login 401 suppression | `web/src/stores/authStore.ts` + `web/src/lib/api.ts` | Expected `/auth/login` 401s do not fire the global unauthorized handler, so failed logins do not clear admin session state |
| Agent streaming message IDs | `services/agent_proxy.py` | `chat_start`, streamed `chat_token`s, and `chat_complete` reuse one assistant `message_id` in both built-in and external-agent paths |
| XML tool-call fallback | `agent_proxy._parse_xml_tool_calls()` | Supports stepfun and other non-function-calling models |
| Variable expression resolver | `backend/app/services/variable_resolver.py` + `mobile/src/utils/variableResolver.ts` | `{{scope.path}}` syntax resolved server-side and client-side; scopes: user, component, self, custom, env, data |
| Trigger definitions | `backend/app/models/trigger.py` + `routers/triggers.py` | Server-event / schedule / data-change triggers with action chain JSON; `fire_trigger()` in trigger_engine.py walks the chain through action_registry |
| Action catalog (22 total) | `backend/app/services/action_registry.py` | 9 server-side handlers + 13 client-only stubs; expandable via `registry.register()` |
| Rule builder | `web/src/editor/RuleBuilder.tsx` | Notion-style visual builder for per-cell action rules (trigger → action steps); stored as `rules` on EditorCell |

---

## Port Map

| Service | Default Port | How to change |
|---------|-------------|---------------|
| Backend FastAPI | `8000` | `SERVER_PORT` in `.env` |
| Web Admin Panel (Vite) | `5173` | `web/vite.config.ts` or `--port` CLI arg |
| Standalone agent web UI / api_server | `7860` | `AGENT_WEB_PORT` in `.env` or `--port` CLI arg |
| WebSocket | Same as backend (`8000`) | `ws://host:8000/ws?token=...` |
| MCP endpoint | Same as backend (`8000`) | `http://host:8000/mcp/` |

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
| `SERVER_PORT` | `8000` | Port |
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
| `HELM_MCP_URL` | `http://localhost:8000/mcp/` | MCP URL used by standalone agent |

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
