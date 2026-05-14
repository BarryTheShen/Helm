# Project Map

Current state of the Helm codebase. Updated 2026-05-15 (FF4 Reassessment: cleanup service, CalendarEvent fields, cell width validation).

## File Counts (Verified)

| Module | Files | Notes |
|--------|-------|-------|
| Models | 32 | SQLAlchemy ORM (`backend/app/models/`) |
| Schemas | 29 | Pydantic request/response (`backend/app/schemas/`) |
| Routers | 28 | FastAPI route modules (`backend/app/routers/`) |
| Services | 21 | Business logic (`backend/app/services/`) |
| Test Files | 23 | pytest-asyncio (`backend/tests/`) |

Verify with: `find backend/app/<dir> -name '*.py' ! -name '__init__*.py' | wc -l`

## Ports

| Service | Port | Config |
|---------|------|--------|
| Backend API | 8000 | `backend/app/config.py` (`server_port: int = 8000`) |
| Web Admin (dev) | 5174 | `web/vite.config.ts` (`port: 5174`) |
| Web Admin (Docker) | 8000 | Same port as backend — served via `SERVE_STATIC=true` |
| Standalone Agent | 7860 | `agent/api_server.py` |
| Docker Web Admin | 8080 | `docker-compose.yml` |

## Tech Stack

| Layer | Stack |
|-------|-------|
| Mobile | React Native 0.83 / Expo 55, TypeScript strict, Zustand |
| Web Admin | React 19, Vite 8, Tailwind 4, React Router 7 |
| Backend | Python FastAPI 0.115, SQLAlchemy async, SQLite |
| Agent | PydanticAI + OpenRouter |
| Protocol | WebSocket + REST + MCP StreamableHTTP |
| QA | Playwright, pytest-asyncio |
| Deployment | Docker / docker-compose (bundled web+backend on port 8000) |

## Directory Map

```
Helm/
├── AGENTS.md                  # AI agent instructions (primary)
├── CLAUDE.md                  # Claude Code compat wrapper → AGENTS.md
├── agent/                     # Standalone PydanticAI agent
│   ├── helm_agent.py          # REPL / web / one-shot modes
│   └── api_server.py          # SSE server for external agent mode
├── backend/                   # Python FastAPI server
│   ├── app/
│   │   ├── main.py            # FastAPI app, lifespan, middleware
│   │   ├── config.py          # Settings (pydantic-settings)
│   │   ├── models/            # 32 SQLAlchemy ORM models
│   │   ├── schemas/           # 29 Pydantic schemas
│   │   ├── routers/           # 28 FastAPI route modules
│   │   ├── services/          # 21 business logic modules
│   │   ├── mcp/               # MCP server + tool implementations
│   │   └── utils/             # security.py (JWT, bcrypt)
│   └── tests/                 # 23 test files
├── mobile/                    # React Native (Expo) app
│   ├── app/                   # Expo Router screens
│   └── src/                   # Components, stores, services, hooks, utils
├── web/                       # Web admin panel (Vite + React)
│   └── src/
│       ├── pages/             # Admin pages
│       ├── editor/            # 3-panel SDUI editor
│       ├── stores/            # Zustand stores
│       ├── lib/               # API client, utils
│       └── editor/            # 3-panel SDUI editor + typeGuards.ts
├── qa/                        # Playwright QA test suite
└── docs/
    ├── ai/                    # AI agent workflows (this directory)
    ├── codebase-explanation/  # Living technical docs
    └── Agentic AI Super App — Project Hub/
        └── Blueprint — Production Spec Documents/
```

## Key Patterns

- **Rows-first editor contract:** The web editor stores data as rows, each row has cells. Screens are arrays of rows.
- **SDUI V2 component registry:** Components registered by PascalCase type string, resolved at render time.
- **Draft-then-approve workflow:** AI proposes UI changes as drafts; user Approves/Rejects before they go live.
- **Connection model:** Encrypted API key storage for external service integrations (Google Calendar OAuth, etc.).
- **React Flow workflows:** Visual workflow editor with branching/loops support.
- **Variable resolver:** Mustache templating (`chevron` on backend, `mustache` on web/mobile) for `@variable` expressions.
