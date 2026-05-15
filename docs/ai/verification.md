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

## Feature Feedback / Product-Spec Verification

For Feature Feedback / product-spec work, verification extends beyond layer-specific commands to ensure every requirement is traceable through implementation and testing.

### Layered Smart QA

"Smart QA" is a layered system, not magic. There is no one-button QA solution. The layers are:

1. **Structural discovery** — automated endpoint/schema/component discovery (existing `qa/src/discover.cjs`)
2. **Deterministic E2E tests** — Playwright tests with resilient user-facing locators (`getByRole`, `getByLabel`, `getByText`)
3. **BDD-style acceptance scenarios** — Given-When-Then scenarios derived from acceptance criteria in the requirements ledger
4. **Manual test scripts** — for requirements where automation is impractical (produced in `qa-plan.md`)
5. **Traceability review** — cross-reference every REQ-ID against implementation and test evidence

"QA" in this project refers to the repo's deterministic scripts and tests: `qa/src/discover.cjs`, Playwright tests, pytest, and related checks. `helm-tester` runs and interprets QA evidence but does NOT decide product completeness. `helm-reviewer` checks product completeness against requirements and QA evidence. Neither QA scripts nor agents are autonomous product verification gates — each layer catches different failure modes, and no single layer is sufficient.

### Requirement-Derived QA

For FF work, QA mode is set per requirement in the requirements ledger:

| QA Mode | What To Do |
|---------|------------|
| `automated-test` | Write Playwright/pytest tests with resilient user-facing locators. Verify passes before shipping. |
| `manual-flow-test` | Produce step-by-step manual test script with expected outcomes. Include in `qa-plan.md`. |
| `review-only` | Code inspection checklist. Reviewer verifies acceptance criteria manually. |
| `not-covered` | No coverage. Gates CLOSED unless explicitly deferred with reason. Must be resolved before shipping must-have requirements. |
| `deferred` | Intentionally skipped. Noted in coverage gate with reason. Must be explicitly approved. |

### Workflow-Aware QA Checklist

Beyond structural checks, QA for FF work must cover:

- **User journeys** — realistic multi-step flows end-to-end, not isolated component checks
- **Round-trip tests** — create → read → update → delete cycle for every data entity
- **Save/reload persistence** — data survives page refresh and full browser restart
- **Preview/publish propagation** — changes in editor appear correctly in preview and published views
- **Original complaint reproduction** — verify the exact scenario from the bug report passes
- **Unintended side effects** — regression check on related features, not just the changed ones

### qa-plan.md

For FF sessions, `qa-plan.md` in `.helm-sessions/current/` lists how each REQ-ID will be tested. Format:

| REQ ID | Test Approach | Test Location / Script | Status |
|--------|---------------|----------------------|--------|
| `FF4-DASH-001` | automated-test | `qa/tests/dashboard.spec.ts` | planned |
| `FF4-DASH-002` | manual-flow-test | `.helm-sessions/current/manual-scripts/dash-002.md` | planned |
| `FF4-DASH-003` | review-only | Reviewer checklist item | planned |
