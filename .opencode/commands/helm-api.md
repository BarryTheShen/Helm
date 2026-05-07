---
description: Work on backend API endpoints with protocol-first thinking
agent: helm-backend
---

# /helm-api

Work on the following backend change: $ARGUMENTS

## What It Does

1. **Protocol First** — Before writing implementation code, check if this change affects the API contract (REST responses, WebSocket messages, MCP tool signatures, SDUI schemas). If yes, read `docs/codebase-explanation/protocol.md` and define the contract changes first.
2. Consult `docs/codebase-explanation/backend.md` for existing patterns.
3. Implement: model → schema → router → service → dependency injection.
4. Ensure JWT auth, `require_admin` where needed, and async SQLAlchemy patterns.
5. If the contract affects frontend (web or mobile), document the exact changes for `/helm-ui` follow-up.
6. Write tests in `backend/tests/`.
7. Verify: `cd backend && pytest -q`
8. If endpoints or schemas changed, also run `cd qa && npm run test:backend` to check for drift.

## Rules

- Follow existing patterns: one route per file, one model per file, small focused services.
- Python type hints everywhere.
- No hardcoded secrets — use environment variables via `app/config.py`.
- If the API contract affects the frontend, note the changes for `/helm-ui` follow-up.
- Update `docs/codebase-explanation/backend.md` if adding new endpoints or models.
