# Helm — Future Plans

This document captures planned improvements and features beyond the MVP.
Items are grouped by area.

---

## Current State (as of 2026-03, updated Session 2)

What has already been built:

- **Backend**: FastAPI + SQLAlchemy async + SQLite. Auth (session JWT, setup lockdown), calendar, notifications, workflows (cron scheduler), agent proxy (multi-turn, reasoning model, XML fallback), MCP server (20 tools), SDUI screen storage + draft/approval flow, tab visibility control, action registry (8 handlers), `manage.py` CLI for user management.
- **Frontend**: Expo SDK 55 + Expo Router. 7 tabs (Home, Chat, Modules, Calendar, Alerts, Settings). Singleton WebSocket (`WebSocketContext`, device-aware). AI-controlled tab visibility (`tabsStore`). SDUI rendering engine (`SDUIRenderer.tsx`) with 19 component types over all tabs. `useSDUIScreen` hook for live SDUI updates per module (now also returns `draft`). `useActionDispatcher` hook — all 7 action types execute. `DraftPreview` component for AI-generated draft approval.
- **Standalone Agent**: PydanticAI agent with local browser UI (`chat_ui.html`), REPL, and one-shot modes. Connects to backend MCP + can read/write mobile source.

**Remaining known gaps:**
1. ~~SDUI actions never execute~~ — **FIXED (Session 2)**: `useActionDispatcher` wires all 7 action types
2. Four dead SDUI component files (`AlertComponent.tsx`, `CalendarComponent.tsx`, `FormComponent.tsx`, `ListComponent.tsx`) that should be deleted
3. `logout()` doesn't call `DELETE /auth/logout` — server sessions never invalidated
4. `markNotificationRead` never called — no UI to mark alerts read
5. `handleModulePress` stub — module taps do nothing
6. `fire_trigger()` never called from any router — event-based workflows are dead code
7. Calendar is read-only — no create/edit/delete UI
8. `conversation_id: 'default'` hardcoded — no multi-conversation support

---

## 1. Fully Customizable UI

**Current state:** SDUI is live — the AI can push screens to all 7 tabs via `helm_set_screen`. Tab visibility can be controlled via `helm_hide_tab`/`helm_show_tab`. Component rendering works for 19 types. **All 7 SDUI action types now execute** via the `useActionDispatcher` hook (navigate, go_back, open_url, copy_text, server_action, send_to_agent, toggle).

**Draft/Approval Flow:** The AI defaults to `helm_set_screen(draft=True)`, which queues a draft for human review. The home screen shows a `DraftPreview` banner; the user can approve or reject. On approve the draft becomes live; on reject it is discarded with optional feedback.

**Planned improvements (still needed):**

### ~~1.0 SDUI Action Dispatcher~~ — ✅ DONE (Session 2)
~~Wire `onAction` in `SDUIRenderer.tsx` to actually execute action types~~

Completed: `useActionDispatcher` hook handles all action types. All 7 tab screens use the hook. New action types added: `server_action` (POST /api/actions/execute), `send_to_agent` (WS + navigate), `go_back`, `toggle`, `copy_text` (expo-clipboard). Legacy `api_call` mapped to `server_action`.

### 1.1 Component Theme System
- Replace hardcoded `colors.ts` constants with a dynamic theme object stored in the
  backend per user or per tenant.
- Allow AI agent to push theme updates (primary color, fonts, spacing scale) via an
  MCP `update_theme` tool that triggers a live UI refresh.
- **Fix first**: `userInterfaceStyle: "light"` is hardcoded in `app.json` — wire up the `settingsStore.theme` field.

### 1.2 Tab & Navigation Customization
- ✅ AI can hide/show tabs via `helm_hide_tab`/`helm_show_tab` MCP tools
- Still needed: Let users reorder tabs, custom icons, drawer navigation mode
- Store tab reorder config in `module_states` (extend `_tabs_config`)

### 1.3 Widget & Card Builder
- Each tab can contain a configurable list of **widgets** via SDUI sections
- Widget config is stored as JSON in the backend — already architected via `helm_set_screen`
- Still needed: a builder UI to create SDUI layouts without talking to AI

---

## 2. Visual Drag-and-Drop UI Editor

**Current state (MVP):** The only way to modify what appears in the app is to either
edit TypeScript source files directly or instruct the Helm Agent (AI) to edit them
via `write_frontend_file` or use the MCP `helm_set_screen` tool.

**Planned improvements:**

### 2.1 Web-Based Visual Editor
- A separate web panel (served by the backend, accessible at e.g. `/editor`) where
  any user can drag and drop widgets, reorder tabs, change colors, and preview
  changes live — without touching code or talking to an AI.
- Built with a React drag-and-drop library (e.g., `dnd-kit` or `react-beautiful-dnd`).
- Changes are saved as JSON configuration to the backend, not as code changes.

### 2.2 Real-Time Preview
- The mobile app subscribes to a WebSocket event `ui_config_changed`.
- When the editor saves, the app re-renders the affected screens immediately without
  a full reload.

### 2.3 Template Library
- Pre-built layout templates (e.g., "Daily Planner", "Project Tracker", "Health Log")
  that users can apply in one click.
- Community-contributed templates hosted as a separate open-source registry.

### 2.4 Human vs. AI Edit Mode
- The editor has two modes:
  - **Human mode** — visual, WYSIWYG, no code.
  - **AI mode** — instruct the Helm Agent in natural language.
- Both modes operate on the same underlying JSON config, so results are identical.

---

## 3. MCP Server Improvements

**Current state:** The MCP server has 20 tools (up from 17 in Session 2). Added: `approve_draft`, `reject_draft`, `get_draft`. `helm_set_screen` now has a `draft` parameter (default `True`) enabling human-in-the-loop approval. Tool naming uses `helm_` prefix throughout.

**Planned improvements:**

### 3.1 Better Tool Descriptions
- Rewrite all tool docstrings to follow a consistent `What / When to use / Example`
  format.
- Add concrete examples in docstrings so the model can pattern-match.

### 3.2 Wire `fire_trigger()` in Routers
- `workflow_engine.fire_trigger()` exists but NO router calls it.
- Wire it up: calendar routers should call `fire_trigger('event_created', ...)` on event creation, etc.
- This makes event-driven workflows actually work.

### 3.3 Structured Error Responses
- Tools should return structured errors with codes (e.g., `NOT_FOUND`, `INVALID_INPUT`)
  rather than raising unhandled exceptions.

### 3.4 New Tools (planned)
- `calendar_find_free_slot` — suggest a free time slot given duration and constraints.
- `notification_dismiss` — mark a notification as read/dismissed.
- `task_create` / `task_complete` — basic task tracking module.

---

## 4. Forms — SDUI-Driven Dynamic Forms

**Current state:** The Forms tab has been replaced by SDUI — any tab can render a form via the `form` SDUI component. Static placeholder screen removed. Form submission now works: `server_action` action type POSTs to `/api/actions/execute` which calls the `submit_form` handler in the action registry — stores submissions in `module_states` DB.

**Planned improvements:**

### ~~4.1 Form Submission Action~~ — ✅ DONE (Session 2)
~~Wire the SDUI `api_call` action in `FormRenderer` to POST the form data to a backend endpoint.~~

Completed: `FormRenderer` handles `server_action`, merges form values into params, calls `executeAction()`. Backend `submit_form` stores in `module_states`. SQLAlchemy JSON mutation bug fixed (copy-on-write).

### 4.2 AI-Generated Forms
- The Helm Agent can create custom forms via `helm_set_screen` with a `form` component payload.

### 4.3 Submission Storage & Query
- `GET /api/forms/{form_id}/submissions` endpoint.
- AI agent can query submissions via MCP.
- Trigger workflows on submission.

---

## 5. Alerts — Real-Time Push Notifications

**Current state:** WebSocket push for notifications partially works — the `notification` WS event exists. The Alerts tab polls REST on mount but doesn't listen for live WS events. `markNotificationRead` API method exists but is never called.

**Planned improvements:**

### 5.1 Wire Real-Time Alerts
- `alerts.tsx` should subscribe to WS `notification` events and append them live.
- Show in-app banner for new notifications.

### 5.2 Mark as Read
- Wire `markNotificationRead(id)` call when user taps a notification.
- "Mark all read" button.

### 5.3 Notification Actions
- Render `actions` array on notification cards as tappable buttons.

### 5.4 Mobile Push (APNs / FCM)
- Integrate Expo Notifications for native push when app is in background.

---

## 6. Authentication & Multi-User

**Current state:** Single-user session JWT. `logout()` doesn't invalidate server session.

**Planned improvements:**

- Fix `logout()` to call `DELETE /auth/logout`.
- Multiple user accounts with role-based access.
- OAuth 2.0 providers (Google, GitHub).
- Per-user isolated data.

---

## 7. Calendar — Full CRUD

**Current state:** Calendar is read-only. Fetch and display works. No create/edit/delete UI.

**Planned improvements:**
- Create event modal (title, date/time, all-day toggle, color picker).
- Tap event to edit/delete.
- Month grid view (current is list view).
- AI creates/edits events via MCP tools and pushes SDUI updates.

---

## 8. Plugin / Connector System

**Current state (MVP):** The backend is a monolith with hardcoded integrations.

**Planned improvements:**
- Plugin architecture: each connected service (Google Calendar, GitHub, Slack, weather, email, etc.) is a self-contained connector with its own MCP tools.
- Connectors can be enabled/disabled per user.
- OAuth flow UI for connectors that require user authorization.

---

## 9. Agent Customization

**Planned improvements:**
- Per-user system prompt customization.
- Model selection UI in settings (already has the agent config API, needs frontend).
- Agent memory — persistent vector-store-backed long-term memory.
- Multi-agent routing — specialized agents for different domains.
- Multi-conversation support (replace hardcoded `conversation_id: 'default'`).

---

## 10. Admin Dashboard

**Planned improvements:**
- Web dashboard at `/admin` for server operators.
- View all users, sessions, workflow runs, MCP call logs.
- Manage connectors and global agent config defaults.

---

## 11. Performance & Scale

**Planned improvements:**
- Switch from SQLite to PostgreSQL for production.
- Redis for WebSocket session state and caching.
- Background job queue (Celery or ARQ) for long-running agent tasks.

---

## Priority Order for Next Milestones

| Priority | Feature | Why |
|----------|---------|-----|
| ✅ Done | ~~SDUI action dispatcher~~ | Navigate/api_call/open_url now execute via `useActionDispatcher` |
| ✅ Done | Action registry + /api/actions/execute | Backend whitelist for SDUI `server_action` calls |
| ✅ Done | Draft/approval flow | AI queues draft; user approves/rejects before publishing live |
| ✅ Done | Device-aware WebSocket | `device_id` tracking; `send_to_device()` targeted delivery |
| ✅ Done | Auth setup lockdown + manage.py CLI | POST /auth/setup locked after first user; CLI for additional users |
| P0 | **Delete dead SDUI component files** | Dead code causes confusion; `SDUIRenderer` renders inline |
| P0 | **Fix logout** (call DELETE /auth/logout) | Security — server sessions never invalidated |
| P1 | Wire `fire_trigger()` in calendar/chat routers | Event-driven workflows are dead without this |
| P1 | Wire `markNotificationRead` in `alerts.tsx` | Basic UX hygiene |
| P1 | Calendar create/edit/delete UI | Calendar is currently read-only |
| P2 | Real-time WebSocket push to Alerts | Core "live AI" experience |
| P2 | Module tap handler (`handleModulePress`) | Tapping a module does nothing |
| P2 | Multi-conversation support | Remove `conversation_id: 'default'` hardcode |
| P2 | Explicit device push routing | Send WS events to a specific device, not broadcast |
| P3 | Dark mode | Tokens exist, need `Appearance.getColorScheme()` wiring |
| P3 | Visual UI editor (human mode) | Non-AI users need direct control |
| P3 | Template bundling | Package SDUI screen JSON as shareable templates |
| P3 | Plugin / connector system | Extensibility |
| P4 | Data pipeline / streaming | Live data feeds into SDUI components |
| P4 | Multi-user + OAuth | Production-readiness |
| P4 | Admin dashboard | Operations visibility |
