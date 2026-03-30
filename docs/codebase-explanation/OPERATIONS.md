# Helm — Operations Guide

How to run, configure, and edit every part of the stack.

---

## Quick Start (Full Stack)

```bash
# Terminal 1 — Backend
# .env lives at the REPO ROOT (Helm/.env), not inside backend/
cp .env.example .env          # first time only — from repo root
# edit .env with your keys (see API Keys section below)
cd backend
python -m venv .venv          # first time only
source .venv/bin/activate
pip install -e ".[dev]"       # first time only
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd mobile
npm install                   # first time only
npx expo start
```

Then open the Expo Go app on your phone and scan the QR code **or** press `i` for iOS Simulator.

At first launch the app shows a **Connect** screen. Type in your backend URL:
- Local device on same WiFi: `http://YOUR_MACHINE_IP:8000`
- Local machine / simulator: `http://localhost:8000`

---

## Backend

### One-time setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Linux/Mac
# .venv\Scripts\activate           # Windows

pip install -e ".[dev]"            # installs app + dev deps (pytest etc.)
cp .env.example .env
# → edit .env with your values (see API Keys section)
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
| `http://localhost:8000/mcp` | MCP server endpoint (SSE) |
| `ws://localhost:8000/ws/{token}` | WebSocket for AI chat |

### Database migrations

```bash
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
pytest                      # all 55 tests
pytest -v                   # verbose
pytest tests/test_auth.py   # single file
pytest --cov=app            # with coverage
```

Test files:
| File | Tests | Covers |
|------|-------|--------|
| `tests/test_auth.py` | 8 | Registration, login, lockdown, JWT |
| `tests/test_calendar.py` | 9 | Calendar CRUD, bulk delete |
| `tests/test_notifications.py` | 7 | Notifications + mark-read action |
| `tests/test_workflows.py` | 8 | Workflow CRUD, cron scheduling |
| `tests/test_actions.py` | 15 | Action registry, endpoint auth, each handler |
| `tests/test_drafts.py` | 8 | Draft lifecycle (approve / reject / overwrite) |

### User management (CLI)

After the first user is created via the app's login screen or `POST /auth/setup`, that endpoint is **locked** — it returns 409. Use the `manage.py` CLI to create additional users:

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

The CLI uses the same SQLAlchemy models and bcrypt hashing as the REST API — no special privileges needed.

---

## Frontend (Mobile)

### One-time setup

```bash
cd mobile
npm install
```

No `.env` file — the server URL is entered by the user in-app on the Connect screen and stored on-device with `expo-secure-store`.

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

The QR code that appears in the terminal is for the **Expo Go** app — a free sandbox app from Expo that runs your React Native code without needing a full build.

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android)
2. Make sure your phone is on the **same Wi-Fi** as your development machine
3. iOS: scan the QR from the Camera app
   Android: scan from within the Expo Go app's "Scan QR code" screen
4. The app will load and hot-reload on every file save

**If the QR doesn't work / network issues:**
```bash
# Force tunnel mode (works even on different networks, uses ngrok internally)
npx expo start --tunnel

# Or set the URL explicitly to your machine's IP:
EXPO_PUBLIC_API_URL=http://192.168.1.X:8000 npx expo start
```

The Connect screen inside the app needs your backend URL:
- Real device on Wi-Fi: `http://YOUR_MACHINE_IP:8000`
- iOS Simulator (same Mac): `http://localhost:8000`
- Android Emulator: `http://10.0.2.2:8000`

### Running in an iOS Simulator (Mac only)

iOS Simulator requires a Mac with **Xcode** installed:
1. Install Xcode from the Mac App Store
2. Run `sudo xcode-select --install`
3. With Expo running, press `i` — Simulator opens automatically

**Linux development:** The iOS Simulator is Mac-only. On Linux, use the Android emulator or a real device via Expo Go. The app works in the web browser too (`w` key) for basic iteration, though some native APIs (SecureStore, etc.) fall back to localStorage.

### Running in an Android Emulator (Linux/Mac/Windows)

1. Install **Android Studio** from https://developer.android.com/studio
2. Create a virtual device (AVD) — any recent Pixel profile works
3. Start the emulator from Android Studio or `emulator -avd <name>`
4. With Expo running, press `a`

### Build for production

```bash
# Requires EAS CLI + Apple Developer account
npm install -g eas-cli
eas build --platform ios
```

## Standalone PydanticAI Agent (`agent/`)

A fully independent external agent that controls Helm via MCP and can also edit the frontend source code.  It requires no backend imports — just HTTP + file I/O.

### One-time setup

No extra installs needed — reuse the backend venv (pydantic-ai 1.70+ is already installed):

```bash
source backend/.venv/bin/activate
```

Add to `Helm/.env`:

```bash
# From POST /auth/login → session_token
HELM_SESSION_TOKEN=eyJ...

# From https://openrouter.ai/keys (free tier works)
OPENROUTER_API_KEY=sk-or-v1-...

# Optional overrides:
HELM_MCP_URL=http://localhost:8000/mcp/   # default
OPENROUTER_MODEL=stepfun/step-3.5-flash:free  # default; reasoning/thinking models also work
```

### Run

```bash
# Make sure the Helm backend is running first (must serve /mcp/)
cd agent

# Web UI — browser chat at http://localhost:7860:
python helm_agent.py --web
python helm_agent.py --web --port 8080   # custom port

# Interactive terminal REPL:
python helm_agent.py

# One-shot mode:
python helm_agent.py "Send a notification: title='Hello', message='Agent works', severity=info"
python helm_agent.py "What calendar events do I have this week?"
python helm_agent.py "List all files in mobile/app/(tabs)/"
python helm_agent.py "Read mobile/app/(tabs)/chat.tsx and summarise it"
```

Set `AGENT_WEB_PORT=8080` in `.env` to change the default web port.

### What the agent can do

| Capability | How |
|-----------|-----|
| Read/write calendar events | Helm MCP tool `helm_read_calendar`, `helm_create_event`, etc. |
| Send/read notifications | Helm MCP tool `helm_send_notification`, `helm_get_chat_history` |
| Read frontend source | Local tool `read_frontend_file("app/(tabs)/chat.tsx")` |
| Edit frontend source | Local tool `write_frontend_file("app/(tabs)/chat.tsx", content)` |
| List frontend files | Local tool `list_frontend_files("app/(tabs)")` |

**Security:** `write_frontend_file` validates that the path resolves inside `mobile/` before writing. Path traversal attempts are rejected.

---

## API Keys & Environment Variables

The `.env` file lives at the **repo root** (`Helm/.env`), NOT inside `backend/`. `config.py` resolves the path absolutely as `Path(__file__).parent.parent.parent / ".env"` which is the repo root.

### Full `.env` reference

```bash
# ── Database ────────────────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./helm.db
# For Postgres: postgresql+asyncpg://user:password@localhost/helm

# ── Security (REQUIRED — change these) ──────────────────────────────
# Generate SECRET_KEY:  python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=change-me-generate-a-secure-random-key
# NOTE: API keys entered by users are Fernet-encrypted using a key DERIVED
# from SECRET_KEY via SHA-256. Changing SECRET_KEY makes all stored API keys
# irrecoverable. Back up before rotating.

# ENCRYPTION_KEY in config.py is not used by the app — do not rely on it.

# Token lifetimes
ACCESS_TOKEN_EXPIRE_HOURS=24
REFRESH_TOKEN_EXPIRE_DAYS=30

# ── Server ───────────────────────────────────────────────────────────
SERVER_NAME=Helm
SERVER_VERSION=0.1.0
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# ── AI / LLM ─────────────────────────────────────────────────────────
# These are the DEFAULTS. Each user can override them in Settings → Agent Config.
# OpenRouter (recommended — free tier available, 100+ models):
OPENROUTER_API_KEY=sk-or-v1-...       # Required for AI chat
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=stepfun/step-3.5-flash:free
# Reasoning/thinking models (stepfun, qwen3, DeepSeek-R1, etc.) are supported.

# OpenAI (direct fallback — used only if OPENROUTER_API_KEY is empty):
# OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o

# Local model via Ollama:
# OPENAI_API_KEY=ollama
# OPENAI_BASE_URL=http://localhost:11434/v1
# OPENAI_MODEL=llama3.2

# ── MCP ──────────────────────────────────────────────────────────────
MCP_PATH=/mcp

# For MCP client scripts — obtain a session token via POST /auth/login
HELM_SESSION_TOKEN=eyJ...    # expires after ACCESS_TOKEN_EXPIRE_HOURS (default 24h)
HELM_MCP_URL=http://localhost:8000/mcp/  # MUST have trailing slash
```

---

## How the AI Model is Selected

There are two levels of config:

1. **Server defaults** — `backend/.env` (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`). Used when a user has no custom agent config.

2. **Per-user agent config** — stored in the `agent_configs` DB table. Editable via `Settings → Agent Config` in the app, or via the REST API:

   ```
   POST /agent-config          — create config
   GET  /agent-config          — get your config
   PUT  /agent-config/{id}     — update config
   ```

   Fields: `base_url`, `model`, `api_key_encrypted`, `system_prompt`, `temperature`, `max_tokens`.

The per-user config takes precedence over `.env` defaults. If a user has no active agent config, the server `.env` values are used.

---

## Using OpenRouter

[OpenRouter](https://openrouter.ai) gives you access to GPT-4, Claude, Llama, Gemini, and hundreds of other models through one API key.

1. Sign up at `https://openrouter.ai` and create an API key.
2. In `backend/.env`:
   ```bash
   OPENAI_API_KEY=sk-or-v1-YOUR_KEY_HERE
   OPENAI_BASE_URL=https://openrouter.ai/api/v1
   OPENAI_MODEL=anthropic/claude-3-5-sonnet    # or any model from openrouter.ai/models
   ```
3. Restart the backend. Done.

Popular OpenRouter model names:
| Model | OpenRouter name |
|-------|----------------|
| GPT-4o | `openai/gpt-4o` |
| Claude 3.5 Sonnet | `anthropic/claude-3-5-sonnet` |
| Llama 3.1 70B | `meta-llama/llama-3.1-70b-instruct` |
| Gemini 1.5 Pro | `google/gemini-pro-1.5` |
| Mistral Large | `mistralai/mistral-large` |

---

## Where The Server URL Is Configured (App Side)

The app has **no hardcoded server URL**. The flow:

1. First launch → user sees the **Connect** screen (`mobile/app/(auth)/connect.tsx`)
2. User types their server URL (e.g. `http://192.168.1.10:8000`)
3. The URL is saved to device storage via `authStore.setServerUrl()` (`mobile/src/stores/authStore.ts`)
4. `ApiClient` and `WebSocketService` both read `serverUrl` from the auth store on every call

To change the server URL after setup: **Settings tab → Server URL** (or delete app data to re-run setup).

---

## File Map — What to Edit for Common Tasks

| Task | File |
|------|------|
| Change AI defaults (model, API key) | `backend/.env` |
| Change system prompt default | `backend/app/services/agent_proxy.py` — `DEFAULT_SYSTEM_PROMPT` |
| Add a new REST endpoint | `backend/app/routers/<name>.py` → register in `backend/app/main.py` |
| Add a new DB table | `backend/app/models/<name>.py` → `alembic revision --autogenerate` |
| Add a new MCP tool | `backend/app/mcp/tools.py` |
| Change token expiry | `backend/.env` — `ACCESS_TOKEN_EXPIRE_HOURS` / `REFRESH_TOKEN_EXPIRE_DAYS` |
| Add a new app screen | `mobile/app/(tabs)/<name>.tsx` + register in `mobile/app/(tabs)/_layout.tsx` |
| Add a new SDUI component | `mobile/src/components/sdui/` + register in `mobile/src/components/sdui/SDUIRenderer.tsx` |
| Change app theme colors | `mobile/src/theme/colors.ts` |
| Change API base URL (hardcode for testing) | `mobile/src/stores/authStore.ts` |

---

## Common Troubleshooting

**`ModuleNotFoundError` on backend start**
→ Make sure your venv is activated: `source .venv/bin/activate`

**`No module named 'app'` when running pytest**
→ Run `pytest` from inside the `backend/` folder, not the repo root.

**`alembic: can't find migrations`**
→ Run `alembic` from inside `backend/` where `alembic.ini` lives.

**App can't connect to backend**
→ Make sure your machine's firewall allows port 8000. On Linux: `sudo ufw allow 8000`
→ Use your real LAN IP (`ip addr`), not `localhost`, when connecting from a physical phone.

**Backend can't find `.env` / API key is empty**
→ `.env` must be at the **repo root** (`Helm/.env`), not `backend/.env`. `config.py` resolves the path as `Path(__file__).parent.parent.parent / ".env"`.

**Chat returns empty messages**
→ Check that `OPENROUTER_API_KEY` is set and valid. Check `OPENROUTER_MODEL` in `.env`. If the model is unknown/unavailable to OpenRouter, you may get a 404 or silent empty response.

**`422 Unprocessable Entity` on calendar filter**
→ Known bug: frontend sends `?start=` but backend expects `?start_date=`. See `AI-TECHNICAL-REFERENCE.md`.

---

## Database changes: permanence and reset

- Changes to the database are persistent. Any change to models followed by applying migrations or modifying the DB file will alter the stored schema and data for the configured database (default: `backend/helm.db`). These changes are permanent unless explicitly reverted or the database is replaced.

### Reset / restore options

1) Quick reset (development): delete the SQLite file and re-run migrations.

```bash
# stop the server (if running)
pkill -f "uvicorn" || true
# backup current DB
cp backend/helm.db backend/helm.db.bak
# remove DB file
rm backend/helm.db
# recreate schema
cd backend
source .venv/bin/activate
alembic upgrade head
```

2) Safer reset (clear schema using sqlite shell):

```bash
# backup first
cp backend/helm.db backend/helm.db.bak
sqlite3 backend/helm.db <<'SQL'
PRAGMA writable_schema = 1;
DELETE FROM sqlite_master WHERE type IN ('table','index','trigger');
PRAGMA writable_schema = 0;
.quit
SQL

cd backend
source .venv/bin/activate
alembic upgrade head
```

3) Postgres or other server DB: drop and recreate the database or provision a fresh DB, then run:

```bash
alembic upgrade head
```

Important: resetting deletes user data. Always create a backup (`cp`) before removing or altering the DB.

---

## External MCP agents — what they can edit (current implementation)

External AI agents connect to Helm via the MCP server (mounted at the path configured by `MCP_PATH`, default `/mcp`). MCP calls are authenticated with a Bearer token (Authorization header). The MCP tools implemented by Helm are thin wrappers over the same backend service functions used by the UI and the agent proxy.

### Available MCP tools and their effects

Read-only tools
- `helm_read_calendar(start_date, end_date)` → reads from `calendar_events` (no mutation).
- `helm_get_chat_history(limit)` → reads from `chat_messages` (no mutation).
- `helm_get_form_data(form_id)` → reads from `module_states` (forms stored in module_state).

Mutating tools (can change DB state)
- `helm_create_event(...)` → creates a row in `calendar_events` (`CalendarEvent`).
- `helm_update_event(...)` → updates rows in `calendar_events` (must match `user_id`).
- `helm_delete_event(event_id)` → deletes a row from `calendar_events` (must match `user_id`).
- `helm_send_notification(title, message, severity)` → creates a `notifications` row and pushes a websocket notification to the client.
- `helm_send_chat_message(content)` → creates a `chat_messages` row and pushes a websocket `chat_complete` event.
- `helm_update_module_state(module_type, state)` → creates/updates `module_states` rows and pushes `module_state_update` to the client.

Which DB tables are touched
- `calendar_events` — create/update/delete
- `notifications` — insert
- `chat_messages` — insert
- `module_states` — insert/update

### Authentication & scoping
- MCP requests must include a Bearer token in the `Authorization` header.
- `_MCPAuthMiddleware` (in `app/mcp/server.py`) validates the token and sets `_current_user_id` for the request. A request with a missing or invalid token returns 401.
- All MCP tools read `_current_user_id` to scope writes to the authenticated user.
- The MCP ASGI app is exposed at `http://localhost:8000/mcp/` (note the trailing slash — FastMCP requires it).

### Security recommendations
- Ensure MCP is only reachable by trusted agents (limit network ingress to the `/mcp` path), and use short-lived tokens where possible.
- Audit tools that mutate state: consider adding scopes (e.g., restrict `helm_delete_event` behind an `events:write` scope) and logging all tool calls.
- To test auth: `curl -X POST http://localhost:8000/mcp/ -H "Authorization: Bearer INVALID" -H "Content-Type: application/json"` should return 401.

### How to test an external agent against MCP (quick)

1) Obtain a valid session token via the REST API (`/auth/login`) or from an existing user session in the DB.

2) Example: call `helm_create_event` using a simple HTTP POST to the MCP endpoint. FastMCP exposes a streamable HTTP API; if you're using curl the exact HTTP shape depends on the FastMCP client, but a small Python test script is reliable:

```python
import requests

URL = "http://localhost:8000/mcp/run"  # replace with your MCP server path if different
HEADERS = {"Authorization": "Bearer <SESSION_TOKEN>", "Content-Type": "application/json"}
PAYLOAD = {"tool": "helm_create_event", "args": {"title": "Test", "start_time": "2026-03-25T10:00:00", "end_time": "2026-03-25T11:00:00"}}

resp = requests.post(URL, json=PAYLOAD, headers=HEADERS)
print(resp.status_code, resp.text)
```

If your FastMCP path is different, or if the streamable API is used, prefer the official `fastmcp` CLI or `mcp` client library to call tools.

---
