# Helm — Agentic AI Super App

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.83-000020?logo=expo)](https://expo.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

An open-source, self-hosted AI super app. A universal agentic AI frontend that dynamically renders rich native UI connected to any service via APIs and AI agents.

Think WeChat / Alipay super app model, but AI-native — your personal AI assistant that **controls your app's UI**, not just answers questions.

---

## What Is Helm?

Helm is a mobile-first platform where an AI agent **directly controls your app's UI in real time**. Instead of typing commands and reading text responses, the AI:

- Renders fully custom screens on any tab, live, no app update required
- Adds, edits, and deletes calendar events
- Sends you notifications with custom severity and actions
- Drafts new UI changes for your approval before going live
- Shows/hides and renames navigation tabs dynamically
- Can be extended to control any connected service via MCP tools

The app is a **Server-Driven UI (SDUI) renderer** — the AI sends JSON component payloads and the mobile app renders native components. Zero app updates needed to change any screen.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Native App (iOS / Android / Web)          Expo 55    │
│  SDUI V2 renderer · atomic/structural/composite library     │
│  Home · Chat · Calendar · Forms · Alerts · Modules          │
└───────────────────┬─────────────────────────────────────────┘
                    │  WebSocket (real-time events) + REST API
┌───────────────────▼──────────────────┐  ┌────────────────────┐
│  Python FastAPI Backend   port 9100  │  │  Web Admin Panel   │
│  Auth · Calendar · Chat · Workflows  │  │  (Vite + React)    │
│  Agent Proxy (OpenRouter streaming)  │  │  port 5173         │
│  MCP Server (22 tools)               │  │  SDUI Editor       │
│  Workflow Engine (APScheduler)       │  │  User/Session Mgmt │
└─────────────────┬────────────────────┘  └────────────────────┘
                  │  MCP over HTTP / external agent SSE
┌─────────────────▼───────────────────────────────────────────┐
│  Standalone Helm Agent (PydanticAI + OpenRouter) port 7860   │
│  Developer / admin AI · full MCP access · edits mobile/ src  │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native 0.83.2 / Expo 55.0.8, TypeScript strict mode |
| Mobile navigation | Expo Router 55 (file-based), Zustand stores |
| Backend | Python FastAPI 0.115, SQLAlchemy async, SQLite (aiosqlite) |
| Web admin | React 19 + Vite + Tailwind CSS 4, React Router 7 |
| AI protocol | MCP (Model Context Protocol) StreamableHTTP |
| Agent runtime | PydanticAI + OpenRouter |
| Real-time transport | WebSocket (FastAPI + reconnecting-websocket) |
| Auth | JWT session tokens (bcrypt passwords, Bearer header) |
| Scheduling | APScheduler (cron + event-trigger workflow engine) |
| Tests | pytest-asyncio (113 tests across 15 test files) |

---

## Features

### Core Modules (7 tabs)
| Tab | What it does |
|-----|-------------|
| **Home** | AI-driven SDUI canvas — renders any layout the AI sends |
| **Chat** | Real-time streaming chat with the AI agent |
| **Calendar** | Full month-grid calendar; AI can add/edit/delete events |
| **Forms** | SDUI-driven forms (no hardcoded UI — purely AI-generated) |
| **Alerts** | Notification feed with severity levels and tap actions |
| **Modules** | Launcher for built-in and AI-created custom modules |
| **Settings** | Server URL, account info, logout |

### AI Capabilities
- **Live screen rendering** — AI sends SDUI JSON → app renders native components instantly
- **Draft & approval workflow** — AI proposes UI changes; you Approve / Reject / Add Feedback before they go live
- **Tool-call streaming** — responses stream token by token; tool calls execute mid-stream without blocking
- **Tab control** — hide/show/rename navigation tabs dynamically during a session
- **Custom modules** — AI can create entirely new named tabs with their own SDUI screens
- **Calendar management** — natural-language event creation, date-range reads, bulk delete
- **Notifications** — AI pushes alerts with `info / warning / error / success` severity
- **Workflow automation** — cron-scheduled or event-triggered automations (event created/updated, form submitted, message received)
- **MCP integration** — any MCP-compatible external agent (Claude Desktop, etc.) can drive the whole app

### SDUI Component Library (V2)

The app ships an extensible component registry with four tiers:

| Tier | Components |
|------|-----------|
| **Atomic** | `Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider` |
| **Structural** | `Container` (flexbox, shadows, color tokens, nested children) |
| **Composite** | `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar` |
| **SDUI-specific** | `Badge`, `Stat`, `List`, `Alert` |

Components are registered by PascalCase type string and resolved at render time — new components can be added without changing the renderer itself.

### Web Admin Panel

A React + Vite web dashboard for administrators at `http://localhost:5173`:

- **Dashboard** — system stats (users, sessions, events, workflows)
- **Users** — create, edit, delete, list users
- **Sessions** — view and revoke active sessions
- **Audit Log** — filterable audit trail of all security-relevant actions
- **Workflows** — create and manage automation workflows
- **Templates** — save and reuse SDUI screen templates
- **Component Registry** — view/edit registered SDUI component definitions
- **SDUI Editor** — 3-panel visual editor (structure tree + canvas + property inspector) with device presets, drag-to-reorder, undo/redo, draft/publish flow, and JSON import/export

---

## Getting Started

### Option A — Docker (fastest)

```bash
cp .env.example .env
# Edit .env and set SECRET_KEY, ENCRYPTION_KEY, and one provider key
docker compose up -d

# Create your first admin account
docker compose exec backend python /app/../manage.py create_user \
  --username admin --password yourpassword
```

Web admin: <http://localhost:8080> — API: <http://localhost:9100>

### Option B — Local Dev

### Prerequisites

- Python 3.11+ (if your `python` is aliased to the system Python like 3.13, that's fine — we'll call the venv's python directly)
- Node.js 18+ and npm
- An AI provider API key — free options: [OpenRouter](https://openrouter.ai/keys), [SiliconFlow](https://siliconflow.cn), or [Groq](https://console.groq.com/)

### 1. Environment variables (do this FIRST)

Create `backend/.env`:

```env
# Required — generate both:
#   python -c "import secrets; print(secrets.token_hex(32))"
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
SECRET_KEY=<paste token_hex output>
ENCRYPTION_KEY=<paste Fernet.generate_key output>

# Pick ONE provider and set its key
DEFAULT_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...

DATABASE_URL=sqlite+aiosqlite:///./helm.db
SERVER_PORT=9100
```

The backend will refuse to start if `ENCRYPTION_KEY` is missing — this is intentional; it encrypts stored API keys.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 9100
```

> If your shell aliases `python` globally (e.g. `/Library/Frameworks/Python.framework/...`), always call `.venv/bin/python` explicitly so you don't accidentally use the system Python.

Verify it's up: `curl http://localhost:9100/health`.

### 3. Create your admin account

In another terminal:

```bash
cd backend
.venv/bin/python manage.py create_user --username admin --password yourpassword
# Forgot the password later? Reset it:
.venv/bin/python manage.py reset_password --username admin --password newpassword
```

### 4. Web Admin Panel

```bash
cd web
npm install
npm run dev             # http://localhost:5174
```

Log in with the admin credentials you just created. The web admin lets you build SDUI screens, edit workflows, manage connections, and view logs.

### 5. Mobile App

```bash
cd mobile
npm install
npx expo install --fix   # aligns package versions with Expo 55 Go
npx expo start           # then press `i` for iOS sim, `a` for Android sim, or scan the QR with Expo Go
```

On the **Connect** screen, enter the server URL for your target:

| Target | Server URL |
|---|---|
| iOS simulator on Mac | `http://localhost:9100` |
| Android emulator | `http://10.0.2.2:9100` |
| Physical phone on same Wi-Fi | `http://<mac-lan-ip>:9100` (find with `ipconfig getifaddr en0`) |

Then log in with the same admin credentials.

### 6. Try the AI

The AI lives behind the **Chat** tab. Open it and type:

> "Build me a home screen with a greeting card and 3 news article cards about AI."

The agent will call `helm_set_screen` + `helm_approve_draft`, and the **Home** tab will re-render live with the JSON the agent just authored — zero app rebuild. That's the whole pitch of Helm.

Other things to try:
- *"Add a calendar event tomorrow at 3pm called Review Helm"* → check the Calendar tab
- *"Send me a warning notification saying tests pass"* → check the Alerts tab
- *"Rename the Chat tab to Assistant"* → tab bar updates live

### 5. Standalone Agent (Optional)

The standalone Helm Agent is a developer / power-user tool with a browser chat UI that has full MCP access and can also read/write mobile source files:

```bash
source backend/.venv/bin/activate
cd agent
python helm_agent.py --web          # http://localhost:7860
```

Example commands:
- *"Show me my calendar for this week"*
- *"Add a standup meeting tomorrow at 9am"*
- *"Send me a warning notification: deployment complete"*
- *"Set the home tab to a dashboard with a greeting and my next 3 events"*
- *"Hide the forms tab and rename modules to My Journal"*

#### Running as an External Agent Service

When `EXTERNAL_AGENT_URL=http://localhost:7860` is set, the backend forwards all mobile chat to the standalone agent instead of using the built-in LLM proxy:

```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload

# Terminal 2 — external agent
cd agent && python api_server.py   # default port 7860
```

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest                              # All 113 tests
pytest -v tests/test_auth.py        # Auth tests
pytest -v tests/test_calendar.py    # Calendar tests
pytest -v tests/test_drafts.py      # Draft/approval workflow tests
pytest -v tests/test_sdui_parity.py # SDUI format parity tests
pytest -v tests/test_templates.py   # Template tests
```

Test suite covers: auth, calendar, notifications, workflows, drafts, SDUI parity, templates, users, sessions, actions, admin stats, and sandbox mode.

---

## Project Structure

```
Helm/
├── README.md
├── CLAUDE.md                       # AI agent + contributor instructions
├── agent/
│   ├── helm_agent.py               # Standalone PydanticAI agent (REPL/web/one-shot)
│   ├── api_server.py               # Starlette SSE server (external agent mode)
│   ├── chat_ui.html                # Self-hosted browser chat UI
│   ├── send_prompt.py              # CLI tool to send one-shot prompt to api_server
│   └── README.md
├── backend/
│   ├── pyproject.toml
│   ├── manage.py                   # CLI: create_user, reset_password
│   ├── alembic/                    # DB migrations
│   └── app/
│       ├── main.py                 # FastAPI app, lifespan, middleware
│       ├── config.py               # Settings (pydantic-settings + .env)
│       ├── routers/                # 15 routers: auth, modules, chat, calendar,
│       │                           # notifications, workflows, actions, users,
│       │                           # sessions, audit, components, templates,
│       │                           # admin, agent_config, websocket
│       ├── services/               # agent_proxy, ws_manager, workflow_engine,
│       │                           # auth, action_registry, audit, component_seed,
│       │                           # sdui_state, template_seed
│       ├── models/                 # 14 SQLAlchemy ORM models
│       ├── schemas/                # Pydantic request/response schemas (15 files)
│       ├── mcp/                    # FastMCP server + 22 tool implementations
│       ├── middleware/             # sandbox.py (X-Helm-Sandbox test aid)
│       └── utils/                  # security.py (JWT, bcrypt)
│   └── tests/                      # 113 pytest-asyncio tests (15 files)
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx             # Root layout + auth guard
│   │   ├── (auth)/                 # connect.tsx, login.tsx
│   │   ├── (tabs)/                 # home, chat, calendar, forms, alerts,
│   │   │                           # modules, settings
│   │   └── module/[moduleId].tsx   # Dynamic custom module route
│   └── src/
│       ├── components/
│       │   ├── atomic/             # SDUIText, SDUIButton, SDUIIcon, SDUIImage…
│       │   ├── structural/         # SDUIContainer
│       │   ├── composite/          # CalendarModule, ChatModule, InputBar…
│       │   └── sdui/               # SDUIRenderer, DraftPreview, legacy V1 components
│       ├── renderer/               # componentRegistry.ts (V2 type → component map)
│       ├── hooks/                  # useSDUIScreen, useActionDispatcher, useBreakpoint
│       ├── stores/                 # authStore, uiStore, settingsStore, tabsStore
│       ├── services/               # api.ts (REST client), websocket.ts, auth.ts
│       ├── contexts/               # WebSocketContext (single shared WS)
│       ├── theme/                  # colors.ts, tokens.ts (resolveColor, shadows)
│       └── types/                  # sdui.ts, api.ts, navigation.ts
├── web/
│   └── src/
│       ├── App.tsx                 # React Router, auth guard, AdminLayout
│       ├── pages/                  # Login, Dashboard, Users, Sessions, Audit,
│       │                           # Workflows, Templates, Components, Editor
│       ├── editor/                 # Custom 3-panel SDUI editor
│       │   ├── useEditorStore.ts   # Zustand store (rows-first contract)
│       │   ├── EditorCanvas.tsx    # Interactive canvas + resize handles
│       │   ├── StructureTree.tsx   # Left panel tree with CRUD + drag reorder
│       │   ├── PropertyInspector.tsx # Right panel contextual editor
│       │   └── ComponentPicker.tsx
│       ├── lib/                    # api.ts (typed admin API client), utils.ts
│       └── stores/                 # authStore (admin auth state)
└── docs/
    ├── codebase-explanation/       # Living technical docs (read before contributing)
    │   ├── AI-TECHNICAL-REFERENCE.md  # File map, data flow, patterns
    │   ├── OPERATIONS.md              # Running services, port reference, env vars
    │   ├── backend.md                 # All endpoints, DB schema, services
    │   ├── frontend.md                # Screens, navigation, V2 component system
    │   ├── protocol.md                # REST API, WebSocket events, MCP, SDUI schemas
    │   ├── agents-and-systems.md      # Agent Proxy, MCP server, Workflows, Agent
    │   └── FUTURE_PLANS.md            # Roadmap
    └── Agentic AI Super App — Project Hub/
        └── Blueprint — Production Spec Documents/
```

---

## How the SDUI Draft Workflow Works

1. AI calls `helm_set_screen(module_id, screen_json)` — stored as a **draft**, not live yet
2. Backend broadcasts `sdui_draft_update` WebSocket event to the app
3. App shows a `DraftPreview` banner with the proposed layout
4. User taps **Approve** → `helm_approve_draft` is called → draft goes live; broadcasts `sdui_screen_update`
5. User taps **Reject** (with optional feedback) → draft deleted; broadcasts `sdui_draft_rejected`
6. AI receives the feedback and can revise its proposal

---

## MCP Tools Reference

Any MCP-compatible agent can connect to `http://localhost:9100/mcp/` with a valid Bearer token:

### Calendar

| Tool | Description |
|------|-------------|
| `helm_read_calendar` | Read events in a date range |
| `helm_read_all_calendar` | Read all events (no date filter) |
| `helm_create_event` | Create a calendar event |
| `helm_update_event` | Update an existing event |
| `helm_delete_event` | Delete a calendar event |
| `helm_delete_all_events` | Bulk-delete all events |

### Notifications & Chat

| Tool | Description |
|------|-------------|
| `helm_send_notification` | Push a notification (info/warning/error/success) |
| `helm_get_chat_history` | Retrieve recent chat messages |
| `helm_send_chat_message` | Inject a message into the chat history |

### SDUI Screens

| Tool | Description |
|------|-------------|
| `helm_set_screen` | Set SDUI screen on a module (saves as draft) |
| `helm_get_screen` | Get current live screen for a module |
| `helm_get_draft` | Get pending draft for a module |
| `helm_approve_draft` | Approve pending draft → goes live |
| `helm_reject_draft` | Reject draft with optional feedback |
| `helm_delete_screen` | Remove a module's SDUI screen |
| `helm_list_screens` | List all modules with AI-generated screens |

### Navigation Tabs

| Tool | Description |
|------|-------------|
| `helm_hide_tab` | Hide a navigation tab |
| `helm_show_tab` | Show a hidden navigation tab |
| `helm_rename_tab` | Rename a tab and/or change its emoji icon |
| `helm_list_tabs` | List all tabs with visibility and name state |

### Other

| Tool | Description |
|------|-------------|
| `helm_update_module_state` | Update legacy module state (calendar/alerts/forms) |
| `helm_get_form_data` | Retrieve form submission data |

---

## Documentation

All living technical docs are in [`docs/codebase-explanation/`](docs/codebase-explanation/README.md).

| Document | Description |
|----------|-------------|
| [AI Technical Reference](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | File map, data flow, known patterns — **read this first** |
| [Operations Guide](docs/codebase-explanation/OPERATIONS.md) | Running services, port reference, env vars |
| [Backend Architecture](docs/codebase-explanation/backend.md) | All endpoints, DB schema, services |
| [Frontend Architecture](docs/codebase-explanation/frontend.md) | Screens, navigation, V2 component system |
| [Protocol Reference](docs/codebase-explanation/protocol.md) | REST API contracts, WebSocket events, MCP tools, SDUI schemas |
| [Agents & Systems](docs/codebase-explanation/agents-and-systems.md) | Agent Proxy, MCP server, Workflow Engine, Standalone Agent |
| [Future Plans](docs/codebase-explanation/FUTURE_PLANS.md) | Roadmap beyond current version |

---

## Known Limitations

- **Calendar UI** — Calendar tab is read-only in the mobile app; add/edit/delete requires the AI or the standalone agent.
- **Mobile push** — APNs/FCM push notifications not yet implemented; notifications require the app to be open.
- **settingsStore** — `navigationMode` and `theme` are persisted but have no effect on the UI yet.
- **conversation_id** — Hardcoded to `'default'`; multi-conversation support is not yet implemented.

---

## Troubleshooting

**Backend refuses to start with `RuntimeError: ENCRYPTION_KEY is required`**
Generate and set one in `backend/.env`:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**`manage.py` can't find `sqlalchemy` / uses system Python 3.13**
Your shell aliases `python` globally. Call the venv's python directly: `.venv/bin/python manage.py ...`.

**Mobile app shows "Native module is null, cannot access legacy storage"**
Package versions drifted from what Expo 55 Go bundles. Fix: `cd mobile && npx expo install --fix && npx expo start --clear`.

**Android emulator can't reach the backend**
Android uses `10.0.2.2` (not `localhost`) to reach the host Mac. Also start uvicorn with `--host 0.0.0.0`, not the default `127.0.0.1`.

**Port 9100 conflicts with something else**
Change `SERVER_PORT` in `backend/.env`, the `--port` flag on uvicorn, the proxy targets in `web/vite.config.ts`, the server URL on the mobile Connect screen, and the `ports:` / `CORS_ALLOW_ORIGINS` in `docker-compose.yml`.

**Chat replies nothing, WebSocket disconnects immediately**
Provider key is missing or invalid. Check `backend/.env`: `DEFAULT_PROVIDER` + the matching `*_API_KEY`. Check backend logs for 401s from the provider.

**"admin already exists" when creating user**
The user already exists. Reset the password: `.venv/bin/python manage.py reset_password --username admin --password newpassword`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, testing expectations, commit style, and how to add MCP tools or SDUI components. [CLAUDE.md](CLAUDE.md) has the deeper coding-convention rules.

Roadmap: [ROADMAP.md](ROADMAP.md).

---

## License

MIT
