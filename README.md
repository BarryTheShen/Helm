# Helm — Agentic AI Super App

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo)](https://expo.dev/)
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
- Shows/hides navigation tabs dynamically
- Can be extended to control any connected service via MCP tools

The app is a **Server-Driven UI (SDUI) renderer** — the AI sends JSON component payloads and the mobile app renders native components. Zero app updates needed to change any screen.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Native App (iOS / Android / Web)                      │
│  SDUI V2 renderer · atomic/composite component library       │
│  Calendar · Chat · Alerts · Forms · Home · Modules           │
└───────────────────┬─────────────────────────────────────────┘
                    │  WebSocket (real-time events) + REST API
┌───────────────────▼─────────────────────────────────────────┐
│  Python FastAPI Backend                           port 8000  │
│  Auth · Calendar · Chat · Notifications · Workflows          │
│  Agent Proxy (OpenRouter streaming, tool-call loop)          │
│  MCP Server (18 tools for any MCP-compatible agent)          │
└─────────────────┬───────────────────────────────────────────┘
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
| Mobile app | React Native 0.83 / Expo 55, TypeScript strict mode |
| State management | Zustand, Expo Router (file-based navigation) |
| Backend | Python FastAPI, SQLAlchemy async, SQLite (aiosqlite) |
| AI protocol | MCP (Model Context Protocol) StreamableHTTP |
| Agent runtime | PydanticAI + OpenRouter |
| Real-time transport | WebSocket (FastAPI + custom WS manager) |
| Auth | JWT sessions (Bearer tokens, bcrypt passwords) |
| Scheduling | APScheduler (cron-based workflow engine) |
| Tests | pytest-asyncio (55 tests) |

---

## Features

### Core Modules (7 tabs)
| Tab | What it does |
|-----|-------------|
| **Home** | AI-driven SDUI canvas — renders any layout the AI sends |
| **Chat** | Real-time streaming chat with the AI agent |
| **Calendar** | Full month-grid calendar; AI can add/edit/delete events |
| **Forms** | Structured input forms (stub — SDUI forms coming) |
| **Alerts** | Notification feed with severity levels and tap actions |
| **Modules** | General-purpose SDUI module slots |
| **Settings** | Configure server URL, API keys, and profile |

### AI Capabilities
- **Live screen rendering** — AI sends SDUI JSON → app renders native components instantly
- **Draft & approval workflow** — AI proposes UI changes; you Approve / Reject / Add Feedback before they go live
- **Tool-call streaming** — responses stream token by token; tool calls execute mid-stream without blocking
- **Tab control** — AI hides/shows navigation tabs dynamically during a session
- **Calendar management** — natural-language event creation, bulk reads, delete-all
- **Notifications** — AI pushes alerts with `info / warning / error / success` severity
- **Workflow automation** — cron-scheduled or event-triggered automations (e.g. daily digests)
- **MCP integration** — any MCP-compatible external agent (Claude Desktop, etc.) can drive the whole app

### SDUI Component Library (V2)

The app ships a pre-built, extensible component registry with three tiers:

| Tier | Components |
|------|-----------|
| **Atomic** | `Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider` |
| **Structural** | `Container` (flexbox, shadows, color tokens) |
| **Composite** | `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar` |

Components are registered by type string and resolved at render time — new components can be added without changing the renderer.

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- An [OpenRouter](https://openrouter.ai/) API key (free tier available)

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Run migrations and start
alembic upgrade head
uvicorn app.main:app --reload   # http://localhost:8000
```

### 2. Environment Variables

Create `Helm/.env`:

```env
# Required
OPENROUTER_API_KEY=sk-or-...       # https://openrouter.ai/keys
SECRET_KEY=your-secret-key-here    # random string for JWT signing

# Optional — defaults shown
OPENROUTER_MODEL=stepfun/step-3.5-flash:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DATABASE_URL=sqlite+aiosqlite:///./helm.db
HELM_MCP_URL=http://localhost:8000/mcp/
EXTERNAL_AGENT_URL=                # set to http://localhost:7860 to use api_server.py
AGENT_WEB_PORT=7860
```

Register and get your session token:

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "yourpassword"}'

# Login — copy session_token from response
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "yourpassword"}'
```

Add `HELM_SESSION_TOKEN=<your token>` to `.env`.

### 3. Frontend

```bash
cd mobile
npm install
npx expo start          # Scan QR with Expo Go on your phone
npx expo start --web    # Or open in browser
```

Open the app → Settings → enter server URL (`http://localhost:8000`) → log in.

### 4. Standalone Agent (Optional)

The standalone Helm Agent is a developer tool with a browser chat UI:

```bash
source backend/.venv/bin/activate
cd agent
python helm_agent.py --web          # http://localhost:7860
```

Example commands:
- *"Show me my calendar for this week"*
- *"Add a standup meeting tomorrow at 9am"*
- *"Send me a warning notification: database backup failed"*
- *"Set the home tab to a dashboard with a greeting card and my next 3 events"*

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
pytest                              # All 55 tests
pytest -v tests/test_calendar.py    # Single file
pytest -v tests/test_drafts.py      # Draft/approval workflow tests
```

Test suite covers: auth, calendar, notifications, workflows, drafts, and SDUI actions.

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
│   ├── alembic/                    # DB migrations
│   ├── app/
│   │   ├── main.py                 # FastAPI app, lifespan, middleware
│   │   ├── config.py               # Settings (pydantic-settings + .env)
│   │   ├── routers/                # auth, calendar, chat, notifications,
│   │   │                           # workflows, modules, websocket, actions, users
│   │   ├── services/               # agent_proxy, ws_manager, workflow_engine, auth
│   │   ├── models/                 # SQLAlchemy ORM (9 models)
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   └── mcp/                    # FastMCP server + 18 tool implementations
│   └── tests/                      # 55 pytest-asyncio tests
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx             # Root layout + auth guard
│   │   ├── (auth)/                 # Login + server connect screens
│   │   └── (tabs)/                 # home, chat, calendar, forms, alerts,
│   │                               # modules, settings
│   └── src/
│       ├── components/
│       │   ├── atomic/             # Text, Button, Icon, Image, Divider…
│       │   ├── structural/         # Container
│       │   ├── composite/          # CalendarModule, ChatModule, InputBar…
│       │   └── sdui/               # SDUIRenderer, DraftPreview, …
│       ├── renderer/               # componentRegistry.ts (V2 type → component map)
│       ├── hooks/                  # useWebSocket, useSDUIScreen, useActionDispatcher, …
│       ├── stores/                 # Zustand: authStore, uiStore, webSocketStore
│       ├── services/               # api.ts (REST client)
│       ├── theme/                  # tokens.ts (colors, shadows, resolveColor)
│       └── types/                  # sdui.ts, api.ts TypeScript types
└── docs/
    ├── codebase-explanation/       # Living technical docs (read before contributing)
    │   ├── README.md               # Index of all docs in this folder
    │   ├── AI-TECHNICAL-REFERENCE.md
    │   ├── OPERATIONS.md
    │   ├── backend.md
    │   ├── frontend.md
    │   ├── protocol.md
    │   ├── agents-and-systems.md
    │   └── FUTURE_PLANS.md
    └── Agentic AI Super App — Project Hub/
        └── Blueprint — Production Spec Documents/
```

---

## How the SDUI Draft Workflow Works

1. AI calls `set_screen(module_id, screen_json)` — stored as a **draft**, not live yet
2. Backend pushes `sdui_draft_update` WebSocket event to the app
3. App shows a `DraftPreview` banner with the proposed layout
4. User taps **Approve** → draft goes live; pushes `sdui_screen_update`
5. User taps **Reject** (with optional feedback) → draft deleted; pushes `sdui_draft_rejected`
6. AI receives the feedback and can revise its proposal

---

## MCP Tools Reference

Any MCP-compatible agent can connect to `http://localhost:8000/mcp/` with a valid Bearer token and use these tools:

| Tool | Description |
|------|-------------|
| `helm_read_calendar` | Read events in a date range |
| `helm_create_event` | Create a calendar event |
| `helm_update_event` | Update an existing event |
| `helm_delete_event` | Delete an event |
| `helm_delete_all_events` | Bulk-delete all events |
| `helm_read_all_calendar` | Read all events (no date filter) |
| `helm_send_notification` | Push a notification |
| `helm_set_screen` | Set SDUI screen on a module (as draft) |
| `helm_get_screen` | Get current screen for a module |
| `helm_get_draft` | Get pending draft for a module |
| `helm_approve_draft` | Approve pending draft → goes live |
| `helm_reject_draft` | Reject draft with optional feedback |
| `helm_delete_screen` | Remove a module's SDUI screen |
| `helm_list_screens` | List all modules with AI-generated screens |
| `helm_hide_tab` | Hide a navigation tab |
| `helm_show_tab` | Show a hidden navigation tab |
| `helm_list_tabs` | List all tabs with visibility state |
| `helm_list_actions` | List registered SDUI action handlers |

---

## Documentation
All living technical docs are in [`docs/codebase-explanation/`](docs/codebase-explanation/README.md).
| Document | Description |
|----------|-------------|
| [AI Technical Reference](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | File map, data flow, known bugs, patterns |
| [Operations Guide](docs/codebase-explanation/OPERATIONS.md) | Running services, port reference, env vars |
| [Backend Architecture](docs/codebase-explanation/backend.md) | All endpoints, DB schema, services |
| [Frontend Architecture](docs/codebase-explanation/frontend.md) | Screens, navigation, V2 component system |
| [Protocol Reference](docs/codebase-explanation/protocol.md) | REST API, WebSocket events, MCP tools, SDUI schemas |
| [Agents & Systems](docs/codebase-explanation/agents-and-systems.md) | Agent Proxy, MCP server, Workflows, Standalone Agent |
| [Future Plans](docs/codebase-explanation/FUTURE_PLANS.md) | Roadmap beyond current version |

---

## Known Limitations

- **Forms** — Currently a static stub. SDUI-driven dynamic forms are planned.
- **Real-time alerts on web** — WebSocket is not connected in Expo web mode; notifications require a manual refresh.
- **Mobile push** — APNs/FCM push notifications not yet implemented.
- **`helm_hide_tab` bug** — Not currently registered in the MCP server due to a code placement issue; fix pending.
- **Workflow trigger wiring** — `EVENT_CREATED`, `EVENT_UPDATED`, and `MESSAGE_RECEIVED` trigger types exist but are not yet wired to their respective routers.

---

## Contributing

See [CLAUDE.md](CLAUDE.md) for full contribution rules. Key points:

- Never commit directly to `main` — branch + PR always
- Fix root causes, not symptoms
- Write a failing test before changing production code
- Verify with live testing before merging

---

## License

MIT
