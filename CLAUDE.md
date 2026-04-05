# Agentic AI Super App

An independent, open-source React Native (Expo) mobile app — a universal agentic AI frontend that dynamically renders rich native UI components connected to any service via APIs. WeChat/Alipay super app model but AI-native.

## Tech Stack

- **Frontend:** React Native (Expo), iOS-first, Android comes free
- **Backend:** Python FastAPI server, self-hosted
- **Protocol:** AG-UI over WebSocket (agent↔frontend communication)
- **AI Agent:** PydanticAI / raw LLM API calls
- **Dev Environment:** Linux (primary), Mac only for final App Store build
- **IDE:** Cursor

## Architecture (Three Layers)

1. **Backend** — Python FastAPI. API gateway, AI agent runtime, plugin/connector system for services (Google Calendar OAuth, weather, email, etc.)
2. **Protocol** — AG-UI protocol. Open-source, framework-agnostic message format. WebSocket transport. Backend sends AG-UI events → app parses and renders.
3. **React Native App** — SDUI renderer. Pre-built component library (calendar, chat, news feed, charts, forms, maps, notifications, lists). JSON payloads → native components.

**Build order:** Backend → Protocol → Frontend.

## Codebase Map

> **AI agents: always read `docs/codebase-explanation/` at the start of every session.**
> These docs describe what actually exists in the code today — not aspirational specs.
>
> | File | Read when... |
> |------|-------------|
> | [docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | **Read this first, every session.** File map, data flow, known bugs, patterns. |
> | [docs/codebase-explanation/OPERATIONS.md](docs/codebase-explanation/OPERATIONS.md) | Running backend/frontend/agent, API keys, `.env` reference. |
> | [docs/codebase-explanation/backend.md](docs/codebase-explanation/backend.md) | Backend architecture, all endpoints, DB schema detail. |
> | [docs/codebase-explanation/frontend.md](docs/codebase-explanation/frontend.md) | Frontend screens, navigation, state management, SDUI. |
> | [docs/codebase-explanation/protocol.md](docs/codebase-explanation/protocol.md) | REST API contracts, WebSocket message types, MCP tools. |
> | [docs/codebase-explanation/agents-and-systems.md](docs/codebase-explanation/agents-and-systems.md) | AI Agent Proxy, MCP Server, Workflow Engine, standalone agent. |

For high-level architecture diagrams see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Blueprint Spec Documents

Detailed production specifications live in `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/`:

- `Frontend Spec — iOS App (React Native : Expo).md` — SDUI renderer, navigation, component catalog, design system
- `Backend Spec — Python FastAPI Server.md` — API endpoints, database schema, MCP server, agent proxy, workflow engine
- `Protocol Spec — Communication Layer.md` — WebSocket, REST, OpenAI-compatible API, MCP, SDUI JSON schema, sequence diagrams

**Read all three specs before starting implementation. When making architectural decisions, consult these docs first.**

## Project Structure

```
Helm/
├── CLAUDE.md
├── agent/
│   ├── helm_agent.py           # Standalone PydanticAI agent (MCP + frontend editor)
│   └── README.md               # How to run + architecture
├── backend/
│   ├── pyproject.toml          # Dependencies + pytest config
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/           # DB migrations
│   ├── app/
│   │   ├── main.py             # FastAPI app, lifespan, middleware
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── database.py         # SQLAlchemy async engine + session
│   │   ├── dependencies.py     # get_current_user, get_db
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── routers/            # FastAPI routers (auth, calendar, chat, etc.)
│   │   ├── services/           # Business logic (auth, agent_proxy, ws_manager, workflow_engine)
│   │   ├── mcp/                # MCP server (FastMCP) + tool implementations
│   │   └── utils/              # security.py (JWT, bcrypt)
│   └── tests/
│       ├── conftest.py         # Shared fixtures (in-memory DB, auth_client)
│       ├── test_auth.py
│       ├── test_calendar.py
│       ├── test_notifications.py
│       └── test_workflows.py
└── docs/
    ├── codebase-explanation/   # ← AI agents: read this folder first every session
    │   ├── AI-TECHNICAL-REFERENCE.md
    │   ├── OPERATIONS.md
    │   ├── backend.md
    │   ├── frontend.md
    │   ├── protocol.md
    │   └── agents-and-systems.md
    └── Agentic AI Super App — Project Hub/
        └── Blueprint — Production Spec Documents/
            ├── Backend Spec — Python FastAPI Server.md
            ├── Frontend Spec — iOS App (React Native Expo).md
            └── Protocol Spec — Communication Layer.md
```

## Commands

### Frontend
npx expo start              # Dev server with hot reload (QR code for Expo Go on real device)
npx expo start --ios        # iOS simulator (requires Mac + Xcode)
npx expo start --android    # Android emulator (requires Android Studio)
npx expo start --web        # Browser (limited native API support)
npx expo start --tunnel     # Tunnel mode (works across networks, uses ngrok)

### Backend
cd backend && uvicorn app.main:app --reload   # FastAPI dev server
cd backend && pytest                           # Run backend tests

### Standalone Agent
source backend/.venv/bin/activate
cd agent && python helm_agent.py --web            # Web UI at http://localhost:7860
cd agent && python helm_agent.py                  # Interactive REPL
cd agent && python helm_agent.py "Your task"      # One-shot mode

### Build
eas build --platform ios    # Production iOS build (Mac required)

## Coding Conventions

- TypeScript strict mode for all frontend code
- Python type hints everywhere on backend (PydanticAI style)
- Functional components only — no class components in React Native
- Named exports, no default exports
- Small, focused files — one component per file, one route per file
- Meaningful variable and function names — code should read like prose
- Keep functions short. If a function needs a comment explaining what it does, it should be split into smaller functions with descriptive names.

## Code Quality Rules — NON-NEGOTIABLE

### Elegant Code, Not Patches

- **Root cause fixes only.** When something breaks, find WHY it broke. Never apply surface-level patches that mask the real issue. If a fix doesn't address the root cause, it's not a fix — it's technical debt.
- **No garbage patches.** Do not add workarounds, hacks, or "temporary" fixes that pile up. Every change should make the codebase cleaner, not messier. If a fix makes you write `// TODO: fix this properly later`, stop and fix it properly now.
- **Understand before changing.** Before modifying any code, understand the full context — what it does, why it exists, what depends on it. Never change code you don't understand.
- **One fix, one concern.** Each fix should address exactly one issue. Do not bundle unrelated changes together.

### Bug Handling — Reproduce → Fix → Verify Loop

When encountering ANY bug or unexpected behavior, follow this exact loop:

1. **REPRODUCE** — Write a failing test or create a minimal reproduction that demonstrates the bug. If you cannot reproduce it, try harder — check edge cases, race conditions, input variations, environment differences. Do NOT skip to fixing. A bug you can't reproduce is a bug you can't verify you fixed.

2. **DIAGNOSE** — Gather evidence. Read error messages, check logs, trace the execution path. Compare against working cases ("why does X work but Y doesn't?"). Identify the actual root cause, not just the symptom. Use diagnostic commands, not guesses.

3. **FIX** — Address the root cause. The fix should be elegant and minimal — change only what needs to change. If the fix requires restructuring, restructure. Do not patch around the problem.

4. **VERIFY** — Run the reproduction from Step 1. The bug must be gone. Run the full test suite. No regressions. **If the fix doesn't work or introduces new issues, REVERT IT COMPLETELY.** Do not keep a failed fix and pile another fix on top of it. Revert to the clean state, re-diagnose with the new information you learned, and try a different approach. Never stack failed attempts hoping the combination works.

5. **DOCUMENT** — When the fix is confirmed working, document: (a) what the root cause was, (b) why this specific fix resolves it, and (c) why it works (the reasoning, not just "it fixed it"). Add this to the commit message and/or code comments. Future developers (and future Claude) need to understand the WHY.

6. **PREVENT** — If applicable, add a test that would catch this class of bug in the future. Update documentation if the bug reveals a non-obvious behavior.

This loop is mandatory. Never skip steps. Never declare a bug fixed without verification. Never keep failed fixes in the codebase.

### Testing

- Write tests FIRST when fixing bugs (the failing test IS the reproduction)
- Every new feature needs tests — unit tests at minimum, integration tests for API boundaries
- Tests must be meaningful — assert the RIGHT value, not just that something returned
- Run the full test suite before committing. No broken tests in main.

### Code Review Checklist (Self-Check Before Committing)

- [ ] Does this change address the root cause, not a symptom?
- [ ] Could this break anything else? Check downstream dependencies.
- [ ] Are there tests covering the change?
- [ ] Is the code readable without comments? If not, refactor.
- [ ] Is there any duplicated logic that should be extracted?
- [ ] Are error cases handled gracefully?
- [ ] Does the change follow existing patterns in the codebase?

## Documentation Rules

- Every new module/component gets a brief docstring or header comment explaining PURPOSE (why it exists), not just what it does
- Update this CLAUDE.md when project structure changes, new commands are added, or new conventions are established
- Keep a CHANGELOG.md updated with every significant change
- When making architectural decisions, document the WHY in a comment or doc — future you needs to know the reasoning

## Important Rules

- NEVER commit directly to main — always branch and PR
- Keep commits atomic — one logical change per commit
- Commit messages: imperative mood, descriptive ("Add calendar component" not "added stuff")
- No console.log in committed code — use proper logging
- No hardcoded secrets, API keys, or URLs — use environment variables
- When in doubt, check the Blueprint specs in the project docs before making architectural decisions

## Known Patterns & Gotchas

<!-- Add patterns and gotchas as you discover them during development -->
(empty — update as the project grows)

## Common Mistakes to Avoid

<!-- Claude: when you make a mistake and get corrected, add it here so you don't repeat it -->
(empty — update as patterns emerge)