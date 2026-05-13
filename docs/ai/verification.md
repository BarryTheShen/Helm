# Verification Guide

Run verification proportional to what you changed. Not every change needs every test.

## Layer-Specific Commands

### Backend Code Changed

```bash
# Required — always run for backend changes
cd backend && pytest -q

# Conditional — if database models changed
cd backend && .venv/bin/python -m alembic check

# Conditional — QA API tests (backend endpoint contracts)
cd qa && npm run test:backend
```

### Web Admin Code Changed

```bash
# Required
cd web && npm run lint

# Conditional — if types or imports changed
cd web && npm run build

# Conditional — if UI behavior changed
cd qa && npx playwright test --project e2e

# Conditional — if React components/hooks changed
npx -y react-doctor@latest web --diff origin/modernize/import-libraries --offline --json
```
 
 ### Mobile Code Changed
 
 ```bash
 # Smoke check — start dev server
 cd mobile && npx expo start
 
 # Conditional — simulator/device check for UI behavior changes
 
 # Conditional — if React Native components/hooks changed
 npx -y react-doctor@latest mobile --diff origin/modernize/import-libraries --offline --json
```

### MCP Tool Changed

```bash
# Backend tests cover MCP tool logic
cd backend && pytest -q

# Conditional — MCP integration smoke test
```

### Agent Runtime Changed

```bash
# Deterministic tool-call/API tests
cd backend && pytest -v backend/tests/test_actions.py
```

### Docs / Config Only

```bash
# Path sanity — verify no stale references
grep -rn "docs/code-explanation/" --include="*.md" . | grep -v "codebase-explanation" | grep -v node_modules

# Port sanity — verify consistent ports
grep -rn "localhost:9100" --include="*.md" --include="*.json" --include="*.ts" . | grep -v node_modules | grep -v worktree

# Secrets check — no hardcoded keys in diff
git diff | grep -iE "api.key|secret|password|token" | grep -v ".env"

# Markdown link sanity (optional)
grep -rn "\]\(http" --include="*.md" docs/ | head -20
```

## Path Sanity Checks

```bash
# Verify correct doc path exists
ls docs/codebase-explanation/

# Verify file counts (update docs if these drift)
find backend/app/models -name '*.py' ! -name '__init__*.py' | wc -l
find backend/app/schemas -name '*.py' ! -name '__init__*.py' | wc -l
find backend/app/routers -name '*.py' ! -name '__init__*.py' | wc -l
find backend/app/services -name '*.py' ! -name '__init__*.py' | wc -l
```

## Port Verification

| Service | Expected Port | Config Location |
|---------|--------------|-----------------|
| Backend | 8000 | `backend/app/config.py` |
| Web Admin | 5174 | `web/vite.config.ts` |
| Agent | 7860 | `agent/api_server.py` |

## Post-Change Checklist

- [ ] Relevant tests pass for the layers changed
- [ ] No stale port references introduced
- [ ] No hardcoded secrets in diff
- [ ] Docs updated if behavior/API/architecture changed (not for every commit)
- [ ] Feature completeness verified against requirements-checklist.md (for feature-level changes)
