# Helm — Future Plans

This document captures planned improvements and features beyond the MVP.
Items are grouped by area. None of these are implemented yet.

---

## 1. Fully Customizable UI

**Current state (MVP):** The app has a fixed set of tabs — Chat, Modules, Calendar,
Forms, Alerts, and Settings — each with a minimal, hardcoded look. Icons are
placeholder emoji, colors are a single dark theme, and there is no user-facing
way to change layouts or styles.

**Planned improvements:**

### 1.1 Component Theme System
- Replace hardcoded `colors.ts` constants with a dynamic theme object stored in the
  backend per user or per tenant.
- Allow AI agent to push theme updates (primary color, fonts, spacing scale) via an
  MCP `update_theme` tool that triggers a live UI refresh.
- Support light mode / dark mode / custom theme presets.

### 1.2 Tab & Navigation Customization
- Let users (or the AI agent) reorder, rename, and hide tabs.
- Support custom tab icons — either from a library (e.g., SF Symbols, Material Icons)
  or uploaded SVG.
- Store tab configuration in `module_state` under a reserved `navigation` module type.

### 1.3 Widget & Card Builder
- Each tab can contain a configurable list of **widgets** (cards, charts, counters,
  feeds) rather than one hardcoded screen.
- Widget config is stored as JSON in the backend and rendered by the SDUI renderer.
- The AI agent can rearrange, add, or remove widgets without a code deploy.

---

## 2. Visual Drag-and-Drop UI Editor

**Current state (MVP):** The only way to modify what appears in the app is to either
edit TypeScript source files directly or instruct the Helm Agent (AI) to edit them
via `write_frontend_file`.

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
  - **Human mode** — visual, WYSIWYG, no code. For users who find AI too expensive
    or just prefer direct control.
  - **AI mode** — instruct the Helm Agent in natural language. The AI uses MCP tools
    to apply the same config changes that the human editor would.
- Both modes operate on the same underlying JSON config, so results are identical.

---

## 3. MCP Server Improvements

**Current state (MVP):** The MCP server exposes 9 tools with minimal descriptions
and limited error handling. Tool naming is inconsistent. Some tools have poor
parameter documentation, making it harder for AI agents to use them correctly.

**Planned improvements:**

### 3.1 Better Tool Descriptions
- Rewrite all tool docstrings to follow a consistent `What / When to use / Example`
  format.
- Add concrete examples in docstrings so the model can pattern-match.
- Make parameter descriptions more explicit about format constraints (e.g.,
  `start_time: ISO 8601 datetime string, e.g. '2026-03-28T09:00:00'`).

### 3.2 Consistent Tool Naming
- Rename all tools to follow a consistent verb-noun pattern:
  - `calendar_list_events`, `calendar_create_event`, `calendar_update_event`,
    `calendar_delete_event`
  - `notification_send`, `notification_list`
  - `chat_send_message`, `chat_list_messages`
  - `module_update_state`, `module_get_state`
  - `form_get_schema`, `form_submit`

### 3.3 Structured Error Responses
- Tools should return structured errors with codes (e.g., `NOT_FOUND`, `INVALID_INPUT`)
  rather than raising unhandled exceptions.
- Agent can handle these gracefully without crashing.

### 3.4 Tool Pagination & Filtering
- `calendar_list_events` should support pagination for large calendars.
- `chat_list_messages` should support cursor-based pagination.

### 3.5 New Tools
- `calendar_find_free_slot` — suggest a free time slot given duration and constraints.
- `notification_dismiss` — mark a notification as read/dismissed.
- `module_list` — list all module types and their current state versions.
- `task_create` / `task_complete` — basic task tracking module.
- `file_read` / `file_write` for a user-scoped file storage area.

---

## 4. Forms — SDUI-Driven Dynamic Forms

**Current state (MVP):** The Forms tab is a hardcoded static form (Name, Email,
Comments). Submitting it only logs to the console. There is no backend integration.

**Planned improvements:**

### 4.1 Form Schema from Backend
- Forms are defined as JSON schemas stored in the backend under `module_state`
  type `forms`.
- The frontend reads the schema on mount and renders the appropriate input types
  (text, number, date, dropdown, checkbox, multi-select, file upload).

### 4.2 AI-Generated Forms
- The Helm Agent can create custom forms via an MCP `form_define` tool:
  ```
  "Create a bug report form with fields: title (required text),
   severity (dropdown: low/medium/high), steps_to_reproduce (textarea)"
  ```
- The form appears live in the app without any code change.

### 4.3 Form Submissions to Backend
- Submissions are POSTed to `/api/forms/{form_id}/submit` and stored in the DB.
- The AI agent can query submissions via a `form_list_submissions` MCP tool.
- Trigger workflows on submission (e.g., send a notification to admin).

---

## 5. Alerts — Real-Time Push Notifications

**Current state (MVP):** The Alerts tab shows a list of notifications fetched from
the REST API. There is no real-time push — you have to navigate away and back to
see new alerts.

**Planned improvements:**

### 5.1 WebSocket Push to Mobile
- The mobile app WebSocket connection (already partially implemented) should listen
  for `notification` events and immediately add them to the alerts list with an
  in-app banner.

### 5.2 Notification Actions
- Notifications support an `actions` array in the schema. The UI should render
  action buttons (e.g., "Approve", "Dismiss", "Open") that send callbacks to the
  backend.

### 5.3 Mobile Push (APNs / FCM)
- Integrate Expo Notifications for native push when the app is in background.
- Requires EAS build and Apple/Google push credentials.

### 5.4 Notification Grouping & Filtering
- Group notifications by type or source.
- Allow marking as read / archive / dismiss.
- Filter by severity (info, warning, error).

---

## 6. Authentication & Multi-User

**Current state (MVP):** Single-user, session-based JWT auth. No multi-tenancy.

**Planned improvements:**

- Multiple user accounts with role-based access (admin vs. user).
- OAuth 2.0 providers (Google, GitHub) as login options.
- Per-user isolated data — calendar, notifications, module states, forms.
- Shared workspaces (family, team) with permission scopes.

---

## 7. Plugin / Connector System

**Current state (MVP):** The backend is a monolith with hardcoded integrations.

**Planned improvements:**

- Plugin architecture: each connected service (Google Calendar, GitHub, Slack,
  weather, email, etc.) is a self-contained connector with its own MCP tools.
- Connectors can be enabled/disabled per user.
- Community connector registry (similar to npm, pip) for sharing connectors.
- OAuth flow UI for connectors that require user authorization.

---

## 8. Agent Customization

**Planned improvements:**

- Per-user system prompt customization ("always respond in Spanish", "use a
  casual tone").
- Model selection UI — let users choose from available OpenRouter models.
- Agent memory — persistent vector-store-backed long-term memory for context
  across sessions.
- Multi-agent support — run specialized agents for different domains (calendar vs.
  code vs. research) and route tasks automatically.

---

## 9. Performance & Scale

**Planned improvements:**

- Switch from SQLite to PostgreSQL for production deployments.
- Add Redis for WebSocket session state and caching.
- Horizontal scaling with sticky sessions or Redis pub/sub for WebSocket.
- Background job queue (Celery or ARQ) for long-running agent tasks.

---

## Priority Order for Next Milestones

| Priority | Feature | Why |
|----------|---------|-----|
| P0 | Real-time WebSocket push to Alerts | Core "live AI" experience |
| P0 | MCP tool naming & descriptions rewrite | AI accuracy depends on this |
| P1 | SDUI-driven dynamic forms | Replaces static MVP stub |
| P1 | Visual UI editor (human mode) | Non-AI users need this |
| P2 | Calendar grid view | Current list view is functional but basic |
| P2 | Component theme system | Personalization |
| P3 | Plugin / connector system | Extensibility |
| P3 | Multi-user + OAuth | Production-readiness |
