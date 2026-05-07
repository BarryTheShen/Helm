---
description: Work on backend API endpoints
agent: helm-backend
---

# /helm-api

Work on the following backend change: $ARGUMENTS

## What It Does

1. Consult `docs/codebase-explanation/backend.md` and `docs/codebase-explanation/protocol.md` for existing patterns.
2. Implement the endpoint: model → schema → router → service → dependency injection.
3. Ensure JWT auth, `require_admin` where needed, and async SQLAlchemy patterns.
4. Write tests in `backend/tests/`.
5. Verify: `cd backend && pytest -q`

## Rules

- Follow existing patterns: one route per file, one model per file, small focused services.
- Python type hints everywhere.
- No hardcoded secrets — use environment variables via `app/config.py`.
- If the API contract affects the frontend (web or mobile), note the changes for `/helm-ui` follow-up.
- Update `docs/codebase-explanation/backend.md` if adding new endpoints or models.
