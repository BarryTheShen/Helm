# Contributing to Helm

Thanks for your interest in Helm. This document explains how to get a working dev environment, where the code lives, and what the bar is for a PR to be merged.

## TL;DR

1. Fork, branch from `main`, commit atomically, open a PR.
2. Backend tests must pass (`cd backend && pytest`), web must build (`cd web && npm run build`).
3. One logical change per PR. Small PRs get reviewed faster.
4. No commits to `main`, no failing tests, no half-done features.

## Project Layout

```
backend/   FastAPI server, SQLAlchemy async, MCP server, workflow engine
web/       Vite + React admin panel (3-panel SDUI editor, workflows, modules)
mobile/    React Native (Expo) app — SDUI renderer
agent/     Standalone PydanticAI agent (optional — for devs)
docs/      Architecture docs + Blueprint specs
```

Read `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` first. It's the most accurate map of the codebase.

## Development Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env         # then fill ENCRYPTION_KEY — see .env for a generator command
alembic upgrade head
python ../manage.py create_user --username admin --password changeme
uvicorn app.main:app --reload
```

### Web Admin

```bash
cd web
npm install
npm run dev                  # http://localhost:5173
```

### Mobile

```bash
cd mobile
npm install
npx expo start               # scan QR with Expo Go, or press `i`/`a`
```

## Testing

- **Backend:** `cd backend && pytest -x -q` — 227+ tests, must be green.
- **Web:** `cd web && npm run build` — tsc + vite must succeed.
- **Mobile:** `npx tsc --noEmit` for type checks.

New features need tests. Bug fixes need a failing test first (reproduction), then the fix, then the test passes.

## Commit Style

Imperative mood, one change per commit:

```
feat: Add module install/uninstall API
fix: Resolve WebSocket stale closure in chat handler
refactor: Extract action registry from router to service
docs: Update protocol spec with module install events
test: Add reproduction for draft publish race
chore: Upgrade Expo SDK to 55
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`.

## Code Conventions

- Python: type hints on every public function, Pydantic V2 schemas for request/response, async SQLAlchemy sessions.
- TypeScript: strict mode, functional components only, named exports.
- Keep functions short. If you need a comment explaining what the code does, split the function.
- Root-cause fixes only — no surface-level patches.
- No hardcoded secrets. Use `backend/.env` for configuration.

## Adding an MCP Tool

Three files must stay in sync:

1. `backend/app/mcp/tools.py` — implementation
2. `backend/app/services/agent_proxy.py` → `_get_tool_definitions()` — exposed to the internal agent
3. `backend/app/mcp/server.py` — registered on the MCP HTTP server

Add a test in `backend/tests/`. Update `docs/codebase-explanation/protocol.md`.

## Adding an SDUI Component

1. Register the component type in the mobile SDUI renderer (`mobile/app/_sdui/`)
2. Add the prop schema to `web/src/editor/componentSchemas.ts`
3. Add a preview renderer to `web/src/components/SDUIPreview.tsx` if needed
4. Update `docs/codebase-explanation/frontend.md`

## Reporting Bugs

Use GitHub Issues. Include:

- What you expected to happen
- What actually happened
- Steps to reproduce (logs, request/response if relevant)
- Git SHA (`git rev-parse HEAD`) and OS/browser version

## Proposing Features

Open a GitHub Discussion first for anything larger than a small addition. We'd rather align on direction before you spend a weekend on code that may not fit.

## Code of Conduct

Be kind. Disagree with ideas, not people. No harassment. We're here to build something useful together.

## Questions?

Open a GitHub Discussion or tag `@LQ458` on an issue.
