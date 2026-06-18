# Helm — Operations Guide

How to run the Helm stack, where each app lives, and which commands are preferred today.

> Last updated: 2026-06-18
> Related docs: `docs/codebase-explanation/backend.md` for backend internals, `docs/codebase-explanation/qa.md` for the Playwright suite.

---

## Tier 1: TL;DR

- `SDUI` means **server-driven UI**.
- Preferred local commands:
  - Backend API: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
  - Web admin: `cd web && npm run dev`
  - Mobile app: `cd mobile && npx expo start`
  - Playwright QA: `cd qa && npm test`
- Fixed service ports:
  - Backend HTTP, WebSocket (WS), and Model Context Protocol (MCP): `8000`
  - Web admin dev server: `5174`
  - Standalone agent web UI / API server: `7860`
- Reading order for new readers:
  1. `docs/codebase-explanation/backend.md`
  2. `docs/codebase-explanation/qa.md`
  3. This file for day-to-day setup and run commands

### Quick port map

| Service | Default address | Notes |
|---------|-----------------|-------|
| Backend HTTP / WS / MCP | `http://localhost:8000` | QA and docs assume this exact port |
| Web admin dev server | `http://localhost:5174` | Keep 5174 free when running QA |
| Standalone agent browser UI | `http://localhost:7860` | Used only for agent mode |
| Mobile app | Expo chooses its own port | Connect the app to backend port 8000 |

---

## Tier 2: Folder map

| Path | What it owns | Notes |
|------|--------------|-------|
| `backend/` | FastAPI server, database, migrations, backend tests, admin CLI | Server-side control plane |
| `web/` | React + Vite admin UI | Includes the SDUI editor |
| `mobile/` | Expo mobile client | Uses a backend URL entered in-app |
| `qa/` | Playwright suite and cleanup helpers | Auto-starts backend + web admin |
| `agent/` | Standalone PydanticAI agent and API server | Runs on port 7860 |
| `docs/codebase-explanation/backend.md` | Backend architecture map | Start here for code flow |
| `docs/codebase-explanation/qa.md` | QA suite map | Start here for test flow |

---

## Run by task

| Task | Preferred command | Notes |
|------|-------------------|-------|
| Full local stack | See [Full local stack](#full-local-stack) | Backend first, then web, then mobile |
| Backend only | See [Backend](#backend) | Requires the repo-root `.env` |
| Web admin only | See [Web admin](#web-admin) | Keep port 5174 free |
| Mobile only | See [Mobile](#mobile) | No fixed port |
| QA suite | See [QA suite](#qa-suite) | Uses fixed backend and web ports |
| Standalone agent | See [Standalone agent](#standalone-agent) | Uses `backend/.venv` |
| Bundled production | See [Bundled production Docker](#bundled-production-docker) | Backend + web in one container |
| Legacy scripts | See [Legacy scripts](#legacy-scripts) | Manual helpers, not CI |

---

## Full local stack

Start the backend first, then the web admin, then mobile if you want the device app.

- Terminal 1 — backend

```bash
# Repo root: create the shared env file once
cp backend/.env.example .env
# Edit .env with your keys before starting the backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Terminal 2 — web admin

```bash
cd web
npm install
npm run dev
```

- Terminal 3 — mobile

```bash
cd mobile
npm install
npx expo start
```

Mobile connection URLs:

- Same machine or simulator: `http://localhost:8000`
- Android Emulator: `http://10.0.2.2:8000`
- Real device on the same Wi-Fi: `http://<your-machine-ip>:8000`

At first launch the mobile app shows a Connect screen. Enter the backend URL there and the app stores it on-device.

---

## Backend

### One-time setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

The shared environment file lives at the repo root (`Helm/.env`), not inside `backend/`.

### Run the dev server

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server URLs:

| URL | What it is |
|-----|-----------|
| `http://localhost:8000` | REST API root |
| `http://localhost:8000/docs` | Swagger UI |
| `http://localhost:8000/redoc` | ReDoc API reference |
| `http://localhost:8000/mcp` | MCP server endpoint |
| `ws://localhost:8000/ws` | WebSocket for AI chat; pass `?token=` in the query string |

### Database migrations

```bash
cd backend
source .venv/bin/activate

# Apply all pending migrations
alembic upgrade head

# Create a new migration after changing a model
alembic revision --autogenerate -m "describe your change"

# Roll back one migration
alembic downgrade -1
```

The SQLite database lives at `backend/helm.db`. Delete it and re-run `alembic upgrade head` if you want a fresh local database.

### Run tests

```bash
cd backend
source .venv/bin/activate
pytest -q
pytest tests/test_auth.py -q
pytest --cov=app
```

Current backend test count: **32 files**.
These tests run the real FastAPI app in-process against SQLite, so they catch route and service wiring issues without mocks.

#### Identity and access
- `test_auth.py`
- `test_users.py`
- `test_sessions.py`
- `test_devices.py`
- `test_settings.py`

#### App, module, template, and SDUI state
- `test_apps.py`
- `test_app_versions.py`
- `test_modules.py`
- `test_module_install.py`
- `test_drafts.py`
- `test_templates.py`
- `test_sdui_parity.py`
- `test_validation_service.py`

#### Content and collaboration
- `test_calendar.py`
- `test_notifications.py`
- `test_todos.py`

#### Automation and integrations
- `test_actions.py`
- `test_workflows.py`
- `test_triggers.py`
- `test_variable_resolver.py`
- `test_variables.py`
- `test_data_sources.py`
- `test_workflow_engine_unit.py`

#### Ops and regression slices
- `test_admin.py`
- `test_sandbox.py`
- `test_deployment.py`
- `test_debug_trace_scripts.py`
- `test_ff3_ff4_partial_closure.py`
- `test_ff4_phase9_app_editor.py`
- `test_ff4_phase10_components.py`
- `test_ff4_phase11_calendar.py`
- `test_ff4_phase12_tpl_wf_mcp.py`

### User management CLI

After the first user is created through `POST /auth/setup`, that endpoint is locked and returns `409`.
Use `manage.py` to create or manage additional users:

```bash
cd backend
source .venv/bin/activate

# Interactive (prompts for username + password)
python manage.py create_user

# Non-interactive
python manage.py create_user --username alice --password supersecret

# Reset a password
python manage.py reset_password --username alice

# List users
python manage.py list_users
```

---

## Web admin

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

The current dev server expects `http://localhost:5174`. The QA suite also assumes that port, so keep it free when you plan to run Playwright.

### Current route map

| Page | URL | Notes |
|------|-----|-------|
| Login | `/login` | Public entry point |
| Editor | `/editor` | Preferred landing page after sign-in |
| App editor | `/app-editor` | App and module management |
| Templates | `/templates` | Template library |
| Workflows | `/workflows` | Workflow builder |
| Variables | `/variables` | Variables and data sources |
| Connections | `/connections` | External connections |
| Logs | `/logs` | Logs view |
| Settings | `/settings` | Settings page |

**Protected surface:** 8 pages plus `/login`.

Legacy aliases:

- `/` redirects to `/editor`
- `/dashboard` redirects to `/editor`

Everything except `/login` is behind the app's protected route wrapper.

### Dev proxy

In development, `web/vite.config.ts` proxies these paths to the backend:

| Prefix | Target |
|--------|--------|
| `/api` | `http://localhost:8000` |
| `/auth` | `http://localhost:8000` |
| `/ws` | `ws://localhost:8000` |

This keeps browser requests same-origin during local development.

### Authentication flow

1. `POST /auth/login` returns `session_token`, `user_id`, `username`, and `role`.
2. The token is stored in `localStorage` as `admin_token`.
3. `web/src/lib/api.ts` adds `Authorization: Bearer <token>` on future requests.
4. `ProtectedRoute` sends you to `/login` when no token is present.

The first admin user is created through the backend CLI because `POST /auth/setup` locks after initial bootstrap.

### Build for production

```bash
cd web
npm run build
```

This outputs the compiled app to `web/dist/`.

---

## Mobile

### One-time setup

```bash
cd mobile
npm install
```

There is no `.env` file for the mobile app. The backend URL is entered on the Connect screen and stored on-device with `expo-secure-store`.

### Run the dev server

```bash
cd mobile
npx expo start
```

Common Expo shortcuts:

| Key | Action |
|-----|--------|
| `i` | Open in iOS Simulator (Mac only, requires Xcode) |
| `a` | Open in Android Emulator (requires Android Studio) |
| `w` | Open in the browser (limited native API support) |
| Scan QR | Open in Expo Go on a real device |

If QR scanning fails across networks, use:

```bash
npx expo start --tunnel
```

### Connect screen

Use one of these backend URLs on first launch:

- Same machine or simulator: `http://localhost:8000`
- Android Emulator: `http://10.0.2.2:8000`
- Real device on the same Wi-Fi: `http://<your-machine-ip>:8000`

### Build for production

```bash
npm install -g eas-cli
# Replace ios with android when needed
eas build --platform ios
```

---

## QA suite

The Playwright QA suite lives in `qa/`. Use the commands in `docs/codebase-explanation/qa.md` for the full map.

Quick version:

```bash
cd qa
npm test
# or, for the full backend pytest + Playwright pipeline
bash run.sh
```

The Playwright suite auto-starts the backend and web admin when needed, then runs against fixed ports `8000` and `5174`.

---

## Standalone agent

The standalone agent reuses `backend/.venv`.

### One-time setup

The agent needs a valid backend session token and, if you use the external-agent path, a model key in `Helm/.env`.

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_user","password":"your_pass","device_id":"agent","device_name":"Agent"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session_token'])"
```

Add the token and agent settings to `Helm/.env`:

| Variable | Use |
|----------|-----|
| `HELM_SESSION_TOKEN` | Agent-to-MCP auth |
| `HELM_MCP_URL` | MCP endpoint for the agent |
| `AGENT_WEB_PORT` | Browser UI and API server port |
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | Model provider credentials |
| `OPENROUTER_MODEL` / `OPENAI_MODEL` | Model selection |

### Run the agent

```bash
source backend/.venv/bin/activate
cd agent

# Browser chat UI at http://localhost:7860
python helm_agent.py --web

# Custom port
python helm_agent.py --web --port 8080

# Interactive REPL
python helm_agent.py

# One-shot task
python helm_agent.py "What's on my calendar this week?"
```

### Agent API server

`api_server.py` runs the agent as a standalone HTTP service. When `EXTERNAL_AGENT_URL` is set in `.env`, the backend forwards mobile-app chat to it instead of calling OpenRouter directly.

```bash
source backend/.venv/bin/activate
cd agent

python api_server.py               # port 7860 by default
python api_server.py --port 8080
# or: uvicorn api_server:app --port 7860 --reload
```

| URL | What it is |
|-----|-----------|
| `http://localhost:7860/` | Browser UI (`chat_ui.html`) |
| `http://localhost:7860/health` | Health JSON |
| `http://localhost:7860/api/run` | SSE stream used by backend `agent_proxy` |
| `http://localhost:7860/api/chat` | SSE chat endpoint used by `chat_ui.html` |

### Send a one-shot prompt from CLI

```bash
source backend/.venv/bin/activate
cd agent
python send_prompt.py "Create a home screen with a greeting"
```

This requires `api_server.py` to already be running on port 7860.

---

## Bundled production Docker

Backend and web admin are bundled into a single container. The Python FastAPI server serves the compiled web admin static files.

```bash
# Build
docker compose build

# Run (single service on port 8000)
docker compose up -d

# Check logs
docker compose logs -f helm

# Stop
docker compose down
```

### Production notes

- `docker-compose.yml` lives at the repo root.
- `.env` lives at the repo root and is passed through to the container.
- Required production secrets: `ENCRYPTION_KEY` and `SECRET_KEY`.
- Persistent SQLite data is stored in the `helm-data:/app/data` volume.
- `SERVE_STATIC=true` enables static file serving in production.
- API routes (`/api/*`, `/auth/*`, `/ws`, `/mcp`) take precedence over static files.
- `/` and `/admin` serve the web admin SPA with client-side routing fallback.

### Port 8000 serves everything

| URL | What it is |
|-----|-----------|
| `http://localhost:8000/` | Web admin in production |
| `http://localhost:8000/admin` | SPA fallback route |
| `http://localhost:8000/api/...` | REST API |
| `http://localhost:8000/ws` | WebSocket |
| `http://localhost:8000/mcp` | MCP server |
| `http://localhost:8000/docs` | Swagger UI |

In development, keep using the separate Vite dev server in `web/` for hot reload.

---

## Shared `.env` reference

The shared environment file lives at the repo root (`Helm/.env`). The backend configuration object in `backend/app/config.py` is the source of truth for the full list of settings.

### Core settings

| Variable | Use |
|----------|-----|
| `DATABASE_URL` | Backend database URL |
| `SECRET_KEY` | JWT and app security |
| `ENCRYPTION_KEY` | Fernet encryption for stored secrets |
| `SERVER_HOST` | Backend bind host |
| `SERVER_PORT` | Backend bind port |
| `SERVE_STATIC` | Enables static file serving in production |
| `MCP_PATH` | MCP mount path |

### Provider settings

| Variable | Use |
|----------|-----|
| `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` / `OPENROUTER_MODEL` | OpenRouter provider |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | OpenAI fallback provider |
| `EXTERNAL_AGENT_URL` | Forwards mobile chat to the standalone agent |

### Agent settings

| Variable | Use |
|----------|-----|
| `HELM_SESSION_TOKEN` | Agent auth token |
| `HELM_MCP_URL` | MCP URL used by the agent |
| `AGENT_WEB_PORT` | Port for `helm_agent.py --web` and `api_server.py` |

### Docker admin auth

| Variable | Use |
|----------|-----|
| `ADMIN_USERNAME` | SQLAdmin BasicAuth username |
| `ADMIN_PASSWORD` | SQLAdmin BasicAuth password |

---

## Legacy scripts

Root-level helper scripts are manual debugging tools, not part of the production app or the current QA suite.

### Ad-hoc browser helpers

- `test-all-buttons.js`
- `test-buttons.js`
- `test-diag.js`
- `test-diag2.js`
- `test-frontend.js`
- `test-openurl.js`
- `helm-live-test.js`
- `helm-sdui-test2.js`

### Python and shell helpers

- `test_mcp_agent.py`
- `test-full-flow.sh`
- `inject-home.py`

Read the top of each file before running it; these scripts may assume old ad-hoc dev setups and are not wired into CI.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `401 Unauthorized` from the API | Token expired | Re-login and update the stored token |
| `429 Too Many Requests` from the LLM | Free-tier rate limit | Wait 2–3 minutes or switch models |
| WebSocket disconnects immediately | Token invalid or expired | Re-login |
| Agent cannot connect to MCP | `HELM_SESSION_TOKEN` missing or expired | Regenerate the token and update `.env` |
| Android Emulator cannot reach backend | Wrong localhost address | Use `http://10.0.2.2:8000` |
| Expo Go cannot reach backend | Device is on a different network | Use `npx expo start --tunnel` |
| Web admin or QA lands on the wrong port | Another process is already on 5174 | Free the port before starting Vite or Playwright |
| Docker container cannot start | Missing required env vars | Check `SECRET_KEY` and `ENCRYPTION_KEY` |

---

## Working notes

- The backend and web admin both assume the current fixed ports. If you change one, update the QA config too.
- Prefer the component-specific setup instructions above when you only need one layer.
- Use `docs/codebase-explanation/qa.md` for the full Playwright map, and `docs/codebase-explanation/backend.md` for backend internals.
