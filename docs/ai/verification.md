# Verification Guide

## Quick Verification Commands

```bash
# Backend tests (must all pass)
cd backend && pytest -q

# Count collected tests
cd backend && pytest --co -q

# Web lint
cd web && npm run lint

# Web build (catches type errors)
cd web && npm run build

# QA test suite (Playwright)
cd qa && npx playwright test

# QA backend-only tests
cd qa && npx playwright test --project backend-only

# QA e2e tests
cd qa && npx playwright test --project e2e
```

## Path Sanity Checks

```bash
# Verify file counts match docs
find backend/app/models -name '*.py' ! -name '__init__*.py' | wc -l   # Should be 25
find backend/app/schemas -name '*.py' ! -name '__init__*.py' | wc -l  # Should be 24
find backend/app/routers -name '*.py' ! -name '__init__*.py' | wc -l  # Should be 25
find backend/app/services -name '*.py' ! -name '__init__*.py' | wc -l # Should be 15
find backend/tests -name 'test_*.py' | wc -l                           # Should be 23

# Verify port references are consistent
grep -rn "localhost:8000" web/vite.config.ts web/package.json mobile/package.json

# Verify docs/codebase-explanation/ path is correct (not docs/code-explanation/)
ls docs/codebase-explanation/
```

## Port Verification

| Service | Expected Port | Config Location |
|---------|--------------|-----------------|
| Backend | 8000 | `backend/app/config.py` |
| Web Admin | 5174 | `web/vite.config.ts` |
| Agent | 7860 | `agent/api_server.py` |

All `generate:api` scripts should target `localhost:8000`.

## Post-Change Checklist

- [ ] Backend tests pass: `cd backend && pytest -q`
- [ ] No stale port references introduced
- [ ] File counts still match (if adding/removing models/routers/schemas)
- [ ] `docs/codebase-explanation/` updated if architecture changed
- [ ] No hardcoded secrets in diff
