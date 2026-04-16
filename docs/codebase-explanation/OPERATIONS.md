# Helm — Operations Guide

How to run, configure, and edit every part of the stack.

> Last updated: 2026-04-16  
> Last audit: 2026-04-16 — ✅ All systems operational

---

## Quick Start (Full Stack)

```bash
# Terminal 1 — Backend
# .env lives at the REPO ROOT (Helm/.env), not inside backend/
cp backend/.env.example .env   # first time only — run from repo root
# edit .env with your keys (see API Keys section below)
cd backend
python -m venv .venv           # first time only
source .venv/bin/activate
pip install -e ".[dev]"        # first time only
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd mobile
npm install                    # first time only
npx expo start

# Terminal 3 — Web Admin Panel (optional)
cd web
npm install                    # first time only
npm run dev                    # Usually http://localhost:5174 (auto-increments if 5173 is busy)
```

Then open the Expo Go app on your phone and scan the QR code **or** press `i` for iOS Simulator.

At first launch the app shows a **Connect** screen. Enter your backend URL:
- Same device / simulator: `http://localhost:8000`
- Real device on same WiFi: `http://YOUR_MACHINE_IP:8000`
- Android Emulator: `http://10.0.2.2:8000`

---

## Port Reference

| Service | Default Port | How to change |
|---------|-------------|---------------|
| Backend FastAPI | `8000` | `SERVER_PORT` env var or uvicorn `--port` arg |
| Web Admin Panel (Vite) | `5174` | `web/vite.config.ts` or `--port` arg (auto-increments if 5173 is busy) |
| Standalone agent web UI / api_server | `7860` | `AGENT_WEB_PORT` env var or `--port` CLI arg |
| WebSocket | Same as backend (`8000`) | `ws://<host>:8000/ws?token=...` |
| MCP endpoint | Same as backend (`8000`) | `http://<host>:8000/mcp/` |

> **Note:** Vite dev server auto-increments the port if the default is busy. Check the terminal output for the actual port.

---

## Backend

### One-time setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Linux/Mac
# .venv\Scripts\activate           # Windows

pip install -e ".[dev]"            # installs app + dev deps (pytest etc.)
# .env lives at repo root:
cp backend/.env.example ../.env
# → edit .env with your values (see API Keys section below)
```

### Run the dev server

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Server starts at `http://localhost:8000`

| URL | What it is |
|-----|-----------|
| `http://localhost:8000` | REST API root |
| `http://localhost:8000/docs` | Auto-generated Swagger UI — test every endpoint here |
| `http://localhost:8000/redoc` | ReDoc API reference |
| `http://localhost:8000/mcp` | MCP server endpoint (Streamable HTTP) |
| `ws://localhost:8000/ws` | WebSocket for AI chat; pass `?token=` as query param |

### Database migrations

```bash
cd backend
source .venv/bin/activate

# Apply all pending migrations (run this after pulling new code)
alembic upgrade head

# Create a new migration after changing a model
alembic revision --autogenerate -m "describe your change"

# Roll back one migration
alembic downgrade -1
```

The database file lives at `backend/helm.db`. Delete it and re-run `alembic upgrade head` to start fresh.

### Run tests

```bash
cd backend
source .venv/bin/activate
pytest                         # all tests
pytest -v                      # verbose
pytest tests/test_auth.py      # single file
pytest --cov=app               # with coverage
```

Test files (18 total):
| File | Covers |
|------|--------|
| `tests/test_auth.py` | Registration, login, lockdown, JWT |
| `tests/test_calendar.py` | Calendar CRUD, bulk delete |
| `tests/test_notifications.py` | Notifications + mark-read action |
| `tests/test_workflows.py` | Workflow CRUD, cron scheduling |
| `tests/test_actions.py` | Action registry, endpoint auth, each handler |
| `tests/test_drafts.py` | Draft lifecycle (set/approve/reject/overwrite) |
| `tests/test_users.py` | User management CRUD (admin-only) |
| `tests/test_sessions.py` | Session listing, revocation |
| `tests/test_templates.py` | SDUI template CRUD, apply, import |
| `tests/test_sandbox.py` | Sandbox mode commit interception |
| `tests/test_admin.py` | Admin stats endpoints |
| `tests/test_triggers.py` | Trigger definition CRUD + test endpoint |
| `tests/test_variable_resolver.py` | Variable expression resolution |
| `tests/test_variables.py` | Custom variables CRUD |
| `tests/test_data_sources.py` | Data source management |
| `tests/test_modules.py` | Module and SDUI screen management |
| `tests/test_sdui_parity.py` | Row-first validate/apply parity, proxy tool defs, streamed message_id reuse |

### User management (CLI)

After the first user is created via `POST /auth/setup`, that endpoint is **locked** (409). Use `manage.py` to create additional users:

```bash
cd backend
source .venv/bin/activate

# Interactive (prompts for username + password):
python manage.py create_user

# Non-interactive:
python manage.py create_user --username alice --password supersecret

# List all users:
python manage.py list_users
```

---

## Frontend (Mobile)

### One-time setup

```bash
cd mobile
npm install
```

No `.env` file — the server URL is entered in-app on the Connect screen and stored on-device via `expo-secure-store`.

### Run the dev server

```bash
cd mobile
npx expo start
```

| Key | Action |
|-----|--------|
| `i` | Open in iOS Simulator (Mac only — requires Xcode) |
| `a` | Open in Android Emulator (requires Android Studio) |
| `w` | Open in browser (limited native API support) |
| Scan QR | Open in Expo Go on a real iPhone/Android |

### Running on a real device with Expo Go

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android)
2. Make sure your phone is on the **same Wi-Fi** as your development machine
3. iOS: scan the QR from the Camera app; Android: scan from within Expo Go
4. The app will load and hot-reload on every file save

**If the QR doesn't work:**
```bash
npx expo start --tunnel   # uses ngrok, works across networks
```

### Running in an iOS Simulator (Mac only)

Requires Mac + Xcode installed. With Expo running, press `i`.

**Linux development:** The iOS Simulator is Mac-only. On Linux, use the Android emulator, a real device via Expo Go, or the browser (`w` key). Secure storage falls back to `localStorage` in browser.

### Running in an Android Emulator

1. Install **Android Studio**
2. Create a virtual device (AVD) in Android Studio
3. Start the emulator
4. With Expo running, press `a`

### Build for production

```bash
npm install -g eas-cli             # requires EAS CLI + Apple Developer account
eas build --platform ios
```

---

## Web Admin Panel (`web/`)

A React + TypeScript web application for administering the Helm backend. Built with Vite, Tailwind CSS, Zustand, and React Router. Includes a custom visual SDUI editor.

### One-time setup

```bash
cd web
npm install
```

### Run the dev server

```bash
cd web
npm run dev
```

Opens at `http://localhost:5173` by default. Requires the backend to be running at `http://localhost:8000`.

> **Port note:** If 5173 is already in use, Vite auto-assigns the next available port (e.g., 5174). The backend always runs on 8000 regardless.

### Vite proxy (dev mode)

In dev mode, `vite.config.ts` proxies these paths to the backend so there are no CORS issues:

| Prefix | Target |
|--------|--------|
| `/api/*` | `http://localhost:8000` |
| `/auth/*` | `http://localhost:8000` |
| `/ws` | `ws://localhost:8000` |

All `fetch('/api/...')` calls in the web panel go through this proxy. In production, deploy the web panel behind the same reverse proxy as the backend.

### Authentication

**Login flow:**
1. `POST /auth/login` → returns `{ session_token, user_id, username, role }`
2. Token is stored in `localStorage` as `admin_token`
3. `ApiClient` in `web/src/lib/api.ts` reads `admin_token` and injects `Authorization: Bearer <token>` on every request automatically
4. `authStore` (`web/src/stores/authStore.ts`, Zustand) holds the decoded user state in memory
5. `ProtectedRoute` in `App.tsx` redirects to `/login` if no token is present

### First-time login / credentials

There are **no hardcoded default credentials** in the codebase (intentional security practice). The first admin user must be created via CLI before the web panel can be used:

```bash
cd backend
source .venv/bin/activate

# Create first admin user:
python manage.py create_user --username admin --password yourpassword

# Reset a forgotten password:
python manage.py reset_password --username admin
```

After the first user is created, `POST /auth/setup` is permanently locked (returns 409).

> **Tests:** `conftest.py` creates a test user programmatically via hashed password — no CLI step needed for the test suite.

### Build for production

```bash
cd web
npm run build    # outputs to web/dist/
```

### Pages

| Page | URL | Description |
|------|-----|-------------|
| Login | `/login` | Authenticates against backend `/auth/login` |
| Dashboard | `/` | Admin stats: users, sessions, WS connections, events, workflows, notifications, screens, templates, audit entries |
| Users | `/users` | CRUD user management (admin-only) |
| Sessions | `/sessions` | View and revoke active sessions |
| Audit | `/audit` | Filterable by action_type, user_id, resource_type, date range |
| Workflows | `/workflows` | CRUD. Dropdown shows 5 of 7 trigger types (DATA_CHANGED and SERVER_EVENT missing) |
| Templates | `/templates` | SDUI template library (CRUD + import/export) |
| Components | `/components` | View/edit registered SDUI component definitions |
| Variables | `/variables` | Two tabs: Variables CRUD + Data Sources management |
| Actions & Triggers | `/actions-triggers` | Two tabs: hardcoded actions catalog (19 actions, 6 categories) + TriggerDefinition CRUD with test button |
| Editor | `/editor` | Custom 3-panel visual SDUI editor with template library, device preview, and draft publishing |

### Custom SDUI Editor

The editor at `/editor` is a custom React + Zustand SDUI editor composed from `web/src/pages/EditorPage.tsx` and `web/src/editor/*`:
- The left panel combines the structure tree with a collapsible template library
- Saved templates load from `/api/templates`, while local starter screens and row templates come from `web/src/editor/templateLibrary.ts`
- Device preview supports presets, rotate, and custom width/height values with an explicit Apply action
- The canvas supports cell resizing, direct row-height drag handles, add-row controls, and a JSON view/import flow
- Row properties include background color, per-side padding, and horizontal scrollability
- The structure tree includes a screen root item plus JSON copy actions for the whole screen and individual rows
- Save writes a draft to `/api/sdui/{module_id}` and Push Live saves then approves it via `/api/sdui/{module_id}/draft/approve`
- The status bar shows unsaved state, last saved time, preview dimensions, and AI connectivity

---

## Standalone PydanticAI Agent (`agent/`)

A fully independent external agent that controls Helm via MCP and can also edit the frontend source code directly. Requires no backend imports — just HTTP + file I/O. Reuses the backend venv.

### Setup (one-time)

No extra installs needed — `pydantic-ai` ships with the backend venv. You need a valid session token:

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user","password":"your_pass","device_id":"agent","device_name":"Agent"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session_token'])"
```

Add to `Helm/.env`:
```ini
HELM_SESSION_TOKEN=eyJ...
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=stepfun/step-3.5-flash:free
```

### Run the agent

```bash
source backend/.venv/bin/activate
cd agent

# Browser chat UI at http://localhost:7860
python helm_agent.py --web

# Custom port
python helm_agent.py --web --port 8080

# Interactive REPL (maintains conversation history)
python helm_agent.py

# One-shot task
python helm_agent.py "What's on my calendar this week?"
```

### Agent API server (for external agent mode)

`api_server.py` runs the agent as a standalone HTTP service. When `EXTERNAL_AGENT_URL` is set in `.env`, the backend forwards all mobile-app chat to it instead of calling OpenRouter directly:

```bash
source backend/.venv/bin/activate
cd agent

python api_server.py               # port 7860 by default
python api_server.py --port 8080
# or: uvicorn api_server:app --port 7860 --reload
```

| URL | What it is |
|-----|-----------|
| `http://localhost:7860/` | Serves `chat_ui.html` browser UI |
| `http://localhost:7860/health` | `{"status":"ok","model":"..."}` |
| `http://localhost:7860/api/run` | SSE stream endpoint — used by backend agent_proxy |
| `http://localhost:7860/api/chat` | pydantic-ai SSE chat endpoint — used by chat_ui.html |

### Send a one-shot prompt from CLI

`send_prompt.py` sends a single message to a running `api_server.py` and prints the streamed response to stdout:

```bash
source backend/.venv/bin/activate
cd agent
python send_prompt.py "Create a home screen with a greeting"
```

Requires `api_server.py` to already be running on port 7860.

### Session token expiry

Tokens expire (default: 720h = 30 days). To reissue:

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user","password":"your_pass","device_id":"agent","device_name":"Agent"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session_token'])"
# Update HELM_SESSION_TOKEN in Helm/.env
```

---

## API Keys (`.env` reference)

`.env` lives at the **repo root** (`Helm/.env`), not inside `backend/`.

```ini
# ─── Backend server ──────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./helm.db
SECRET_KEY=change_me_32_char_hex_string
ENCRYPTION_KEY=       # Fernet key — required to encrypt agent API keys in the DB
ACCESS_TOKEN_EXPIRE_HOURS=720
REFRESH_TOKEN_EXPIRE_DAYS=30
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# ─── LLM providers ───────────────────────────────────────
# Primary: OpenRouter (recommended)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=stepfun/step-3.5-flash:free

# Fallback: OpenAI
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# ─── Optional: external agent routing ────────────────────
# When set, ALL mobile-app chat is forwarded to this URL/api/run
EXTERNAL_AGENT_URL=   # e.g. http://localhost:7860

# ─── MCP ─────────────────────────────────────────────────
MCP_PATH=/mcp

# ─── Standalone agent ────────────────────────────────────
HELM_SESSION_TOKEN=   # JWT token for agent → MCP auth
HELM_MCP_URL=http://localhost:8000/mcp/
AGENT_WEB_PORT=7860   # port for helm_agent.py --web and api_server.py
```

**Generating an ENCRYPTION_KEY:**
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

**OpenRouter Model Selection notes:**
- Free tier models are rate-limited (429) if called too frequently
- Known-working free model: `stepfun/step-3.5-flash:free`
- Paid models: `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`
- Browse available models at https://openrouter.ai/models
- If free models hit 429: wait 2–3 minutes, or add $5 credit to OpenRouter

---

## MCP Configuration

The MCP server is mounted at `http://localhost:8000/mcp`.

**To connect Claude Desktop to Helm's MCP server**, add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "helm": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SESSION_TOKEN"
      }
    }
  }
}
```

**Standalone agent** — set `HELM_MCP_URL` + `HELM_SESSION_TOKEN` in `.env`.

---

## Root-Level Dev & Test Scripts

These scripts live at the repo root and are **not** part of the production app. They are development utilities and debugging tools.

### Playwright E2E tests (official, runs in CI)

```bash
# Install root deps (one-time)
npm install

# Run the full Playwright E2E suite
npx playwright test tests/e2e.spec.ts

# View HTML report after a run
npx playwright show-report
```

Requires both backend (port 8000) and frontend dev server (port 8082) to be running, or let Playwright auto-start them via `playwright.config.ts`.

### Ad-hoc Playwright / Puppeteer scripts (manual, not CI)

These scripts were created during SDUI development sessions. Run them while the frontend dev server is active at `http://localhost:19006` or `http://localhost:8082`:

```bash
node test-all-buttons.js    # Test all SDUI action types across all tabs
node test-buttons.js        # Quick navigate action smoke test
node test-diag.js           # Diagnose SDUI loading on home tab
node test-diag2.js          # Dump all buttons and text across 4 tabs
node test-frontend.js       # Puppeteer smoke test + screenshot
node test-openurl.js        # Verify open_url action fires window.open
node helm-live-test.js      # Full live-app test with screenshots
node helm-sdui-test2.js     # SDUI V2 integration test
```

> **Note:** Some scripts have hardcoded JWT tokens that must be updated before use. Check the top of each file.

### Python dev scripts

```bash
# MCP integration test (needs backend + HELM_SESSION_TOKEN + OPENROUTER_API_KEY)
source backend/.venv/bin/activate
python test_mcp_agent.py

# Shell smoke test (needs backend + frontend both running)
bash test-full-flow.sh

# Inject a sample Wandr/Tokyo SDUI V2 home screen directly (bypasses draft approval)
source backend/.venv/bin/activate
python inject-home.py
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` from API | Token expired | Re-login and update token |
| `429 Too Many Requests` from LLM | Rate-limited on free tier | Wait 2–3 min or switch model |
| WebSocket disconnects immediately | Token invalid or expired | Re-login |
| Agent can't connect to MCP | `HELM_SESSION_TOKEN` missing or expired | Regenerate token, update `.env` |
| Android emulator can't reach backend | Wrong localhost | Use `http://10.0.2.2:8000` not `http://localhost:8000` |
| Expo Go can't reach backend | Device on different network | Use `npx expo start --tunnel` |
| Standalone agent rate limit errors | Using `claude-opus-4-20250514` | Change to `claude-sonnet-4-20250514` in `agent/helm_agent.py` |
| Web admin shows wrong port in docs | Vite auto-incremented port | Check terminal output for actual port (usually 5174) |
