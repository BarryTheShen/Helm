# Helm — Agentic AI Super App

An open-source, self-hosted AI super app. A universal agentic AI frontend that dynamically renders rich native UI connected to any service via APIs and AI agents.

Think WeChat / Alipay super app model, but AI-native — your personal AI assistant that controls your apps, not just answers questions.

---

## What Is Helm?

Helm is a mobile-first platform where an AI agent **directly controls your app's UI in real time**. Instead of typing commands and reading text responses, the AI:

- Adds events to your calendar
- Sends you notifications
- Fills out forms on your behalf
- Updates any module state in the app
- Can be extended to control any connected service

The app acts as a **server-driven UI (SDUI) renderer** — the AI sends JSON payloads and the app renders native components. No app update required to change UI.

---

## Architecture

Three layers work together:

```
┌─────────────────────────────────────────────────────────────┐
│  React Native App (iOS/Android/Web)                          │
│  SDUI renderer · pre-built component library                 │
│  Calendar · Chat · Notifications · Forms · Modules           │
└───────────────────┬─────────────────────────────────────────┘
                    │  WebSocket (AG-UI events) + REST API
┌───────────────────▼─────────────────────────────────────────┐
│  Python FastAPI Backend                                       │
│  Auth · Calendar · Notifications · Chat · Workflows          │
│  Agent Proxy (OpenRouter LLM streaming)                       │
│  MCP Server (tools for AI agents)                            │
└───────────────────┬─────────────────────────────────────────┘
                    │  MCP over HTTP (StreamableHTTP)
┌───────────────────▼─────────────────────────────────────────┐
│  Standalone Helm Agent (PydanticAI)                          │
│  Developer / admin AI with full MCP + frontend file access   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native (Expo), TypeScript strict mode |
| Backend | Python FastAPI, SQLAlchemy async, SQLite |
| AI protocol | MCP (Model Context Protocol) over StreamableHTTP |
| AI agent | PydanticAI + OpenRouter |
| Real-time | WebSocket via FastAPI |
| Auth | JWT sessions (Bearer tokens) |

---

## Features (MVP)

- **Calendar** — AI adds, edits, and deletes calendar events. Refreshes on tab focus.
- **Chat** — AI sends messages that appear in the chat tab in real time.
- **Alerts / Notifications** — AI sends notifications with severity levels and custom actions.
- **Forms** — Quick input form (MVP stub — see Future Plans for SDUI forms).
- **Modules** — Arbitrary state blobs the AI can update; app renders them.
- **Settings** — Configure server URL and authentication.
- **Standalone Agent** — Web chat UI for developers to interact with the backend via MCP tools.

---

## Getting Started

### Prerequisites

- Python 3.11+ with pip
- Node.js 18+ with npm
- An [OpenRouter](https://openrouter.ai/) API key

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Set up the database
alembic upgrade head

# Create an account
uvicorn app.main:app --reload   # starts on http://localhost:8000
```

### 2. Environment Variables

Create `Helm/.env`:

```env
# Required
OPENROUTER_API_KEY=sk-or-...       # from https://openrouter.ai/keys
SECRET_KEY=your-secret-key-here    # any random string for JWT signing

# Optional
OPENROUTER_MODEL=stepfun/step-3.5-flash:free  # default: free model
HELM_MCP_URL=http://localhost:8000/mcp/
DATABASE_URL=sqlite+aiosqlite:///./helm.db
```

After starting the backend, log in to get your session token:

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

### 3. Frontend Setup

```bash
cd mobile
npm install
npx expo start          # Scan QR code with Expo Go on your phone
npx expo start --web    # Or open in browser (limited native APIs)
```

Open the app → enter your server URL (`http://localhost:8000`) → log in.

### 4. Standalone Agent (Optional)

The standalone Helm Agent is a developer tool with a web chat UI:

```bash
source backend/.venv/bin/activate
cd agent
python helm_agent.py --web          # Opens at http://localhost:7860
```

You can type natural language commands like:
- *"Add a meeting tomorrow at 9am"*
- *"List all my calendar events this week"*
- *"Send me a notification that the deployment is complete"*

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest                              # All 32 tests
pytest -v tests/test_calendar.py    # Single file
```

---

## Project Structure

```
Helm/
├── README.md
├── CLAUDE.md                       # AI agent instructions
├── agent/
│   ├── helm_agent.py               # Standalone PydanticAI agent
│   ├── chat_ui.html                # Self-hosted agent web UI
│   └── README.md
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Settings (pydantic-settings)
│   │   ├── routers/                # HTTP + WebSocket endpoints
│   │   ├── services/               # Business logic
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   ├── schemas/                # Pydantic request/response models
│   │   └── mcp/                    # MCP server + tool implementations
│   └── tests/
├── mobile/
│   ├── app/
│   │   ├── _layout.tsx             # Root layout + auth guard
│   │   ├── (auth)/                 # Login / connect screens
│   │   └── (tabs)/                 # Calendar, Chat, Alerts, Forms, Modules
│   └── src/
│       ├── services/api.ts         # Backend REST client
│       ├── stores/                 # Zustand state (auth, ui, websocket)
│       ├── components/             # Shared UI components
│       └── types/                  # TypeScript API types
└── docs/
    ├── codebase-explanation/       # AI agent docs (read first)
    └── Agentic AI Super App — Project Hub/
        └── Blueprint — Production Spec Documents/
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [AI Technical Reference](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | File map, data flow, patterns |
| [Operations Guide](docs/codebase-explanation/OPERATIONS.md) | Running services, API keys, env vars |
| [Backend Architecture](docs/codebase-explanation/backend.md) | Endpoints, DB schema, services |
| [Frontend Architecture](docs/codebase-explanation/frontend.md) | Screens, navigation, state |
| [Protocol Reference](docs/codebase-explanation/protocol.md) | REST API, WebSocket, MCP tools |
| [Agents & Systems](docs/codebase-explanation/agents-and-systems.md) | AI Agent Proxy, MCP Server, Workflows |
| [Future Plans](docs/codebase-explanation/FUTURE_PLANS.md) | Roadmap beyond MVP |

---

## Known MVP Limitations

- **Forms** — Currently a static hardcoded form (no backend integration). Future: SDUI-driven dynamic forms.
- **Alerts** — Shows persisted notifications from the backend. Does not auto-receive real-time pushes on web (WebSocket not connected in Expo web mode).
- **Calendar** — Shows events for the current calendar month only. No calendar grid view yet.
- **MCP tools** — Functional but minimal. Tool descriptions and error handling will be improved.
- **No push notifications** — Mobile push (APNs/FCM) not yet implemented.

---

## License

MIT
