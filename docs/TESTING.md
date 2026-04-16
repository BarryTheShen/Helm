# Helm — Testing Guide

Comprehensive testing procedures and coverage documentation for the Helm agentic AI super app.

> Last updated: 2026-04-16  
> Last full audit: 2026-04-16

---

## Test Coverage Summary

### Backend Tests ✅

**Status:** 200/200 tests passing (100% pass rate)  
**Execution Time:** 117 seconds  
**Framework:** pytest + pytest-asyncio  
**Database:** In-memory SQLite (per-test isolation)

| Module | Tests | Coverage |
|--------|-------|----------|
| Actions | 19 | ✅ Full CRUD + execution |
| Admin | 7 | ✅ Stats endpoints |
| Auth | 13 | ✅ Login, logout, session management |
| Calendar | 9 | ✅ CRUD + bulk operations |
| Data Sources | 16 | ✅ CRUD + validation |
| Drafts | 18 | ✅ Draft workflow + approval |
| Modules | 14 | ✅ CRUD + custom modules |
| Notifications | 8 | ✅ CRUD + bulk delete |
| Sandbox | 10 | ✅ Middleware + DB interception |
| SDUI Parity | 30 | ✅ V1/V2 validation, draft flow |
| Sessions | 10 | ✅ List, revoke, admin operations |
| Templates | 18 | ✅ CRUD + apply + import |
| Triggers | 8 | ✅ CRUD + test endpoint |
| Users | 11 | ✅ CRUD + admin operations |
| Variable Resolver | 5 | ✅ Expression resolution |
| Variables | 8 | ✅ CRUD operations |
| Workflows | 13 | ✅ CRUD + execution |

### Frontend Tests ❌

**Status:** No test suite exists  
**Framework:** None configured  
**Recommendation:** Add Jest + React Native Testing Library

**Untested Areas:**
- Component rendering
- Navigation flows
- WebSocket connection handling
- SDUI rendering logic
- Action dispatch
- State management (Zustand stores)
- Draft approval workflow

### Web Admin Tests ❌

**Status:** No test suite exists  
**Framework:** None configured  
**Recommendation:** Add Vitest + React Testing Library

**Untested Areas:**
- All 10 admin pages
- Authentication flow
- API client
- SDUI editor (3-panel system)
- Rule builder
- Template management

### Standalone Agent Tests ❌

**Status:** No test suite exists  
**Framework:** None configured  
**Recommendation:** Add pytest for agent logic

**Untested Areas:**
- PydanticAI agent execution
- MCP tool integration
- Frontend editor tool
- Error handling (recently improved but not tested)

### Integration Tests ⚠️

**Status:** Partial coverage via root-level scripts  
**Framework:** Ad-hoc Playwright/Puppeteer scripts

**Available Scripts:**
- `test_mcp_agent.py` — MCP connectivity test
- `test-full-flow.sh` — Basic smoke test
- `test-all-buttons.js` — SDUI button action tests
- `helm-live-test.js` — Full live app test

**Gaps:**
- No CI integration
- Hardcoded tokens in some scripts
- No systematic E2E coverage

---

## Running Tests

### Backend Tests

```bash
cd backend
source .venv/bin/activate
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest -x                 # Stop on first failure
pytest -k "test_auth"     # Run specific test pattern
pytest --lf               # Run last failed tests
pytest --cov=app          # Coverage report (requires pytest-cov)
```

### Integration Tests

```bash
# MCP integration test
source backend/.venv/bin/activate
python test_mcp_agent.py

# Shell smoke test (requires backend + frontend running)
bash test-full-flow.sh

# Playwright SDUI tests (requires npm install at repo root)
node test-all-buttons.js
node helm-live-test.js
```

---

## Test Fixtures

Backend tests use shared fixtures from `backend/tests/conftest.py`:

| Fixture | Purpose |
|---------|---------|
| `db_session` | In-memory SQLite session (per-test isolation) |
| `client` | FastAPI TestClient (unauthenticated) |
| `auth_client` | Authenticated TestClient with admin user |
| `test_user` | Pre-created test user (admin role) |
| `test_session` | Valid session token for test_user |

---

## Audit Workflow

The full-system audit workflow used on 2026-04-16:

### 1. Backend Verification

```bash
cd backend
source .venv/bin/activate
pytest -v
```

**Expected:** 200/200 tests passing

### 2. Backend Health Check

```bash
curl http://localhost:8000/health
```

**Expected:** `{"status":"ok","version":"0.1.0"}`

### 3. Web Admin Verification

**Manual Steps:**
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start web admin: `cd web && npm run dev`
3. Navigate to http://localhost:5174 (or port shown in terminal)
4. Test login flow
5. Verify all 10 pages load:
   - Dashboard
   - Users
   - Sessions
   - Audit
   - Workflows
   - Templates
   - Components
   - Editor
   - Variables
   - Actions/Triggers

### 4. Standalone Agent Verification

```bash
source backend/.venv/bin/activate
cd agent
python helm_agent.py --web
```

**Manual Steps:**
1. Navigate to http://localhost:7860
2. Test a simple prompt
3. Verify error messages are actionable (not generic)

### 5. API Endpoint Verification

**Test all major endpoint groups:**
- `/health` — Health check
- `/auth/*` — Authentication
- `/api/users` — User management
- `/api/sessions` — Session management
- `/api/calendar` — Calendar CRUD
- `/api/notifications` — Notifications CRUD
- `/api/workflows` — Workflow CRUD
- `/api/templates` — Template CRUD
- `/api/sdui/*` — SDUI module management
- `/api/actions/*` — Action registry
- `/api/triggers` — Trigger definitions
- `/api/variables` — Variable management
- `/api/data-sources` — Data source management
- `/api/admin/*` — Admin stats
- `/api/audit` — Audit logs
- `/ws` — WebSocket connection
- `/mcp/` — MCP server

---

## Known Test Gaps

### High Priority

1. **Frontend test suite** — No automated tests for React Native app
2. **Web admin test suite** — No automated tests for admin panel
3. **E2E test suite** — No systematic end-to-end coverage
4. **WebSocket tests** — No live connection tests in backend suite

### Medium Priority

5. **MCP server tests** — No integration tests for MCP endpoints
6. **Standalone agent tests** — No unit tests for agent logic
7. **Performance tests** — No load testing or benchmarks
8. **Security tests** — No penetration testing or vulnerability scans

### Low Priority

9. **Visual regression tests** — No screenshot comparison
10. **Accessibility tests** — No a11y validation

---

## Test Writing Guidelines

### Backend Tests

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_example(auth_client: AsyncClient):
    """Test description following pytest conventions."""
    # Arrange
    payload = {"key": "value"}
    
    # Act
    response = await auth_client.post("/api/endpoint", json=payload)
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "value"
```

**Conventions:**
- Use `@pytest.mark.asyncio` for async tests
- Use `auth_client` for authenticated requests
- Use `client` for unauthenticated requests
- Follow Arrange-Act-Assert pattern
- One assertion per logical concept
- Descriptive test names: `test_<action>_<expected_result>`

### Integration Tests

```python
import pytest
from playwright.async_api import async_playwright

@pytest.mark.asyncio
async def test_ui_flow():
    """Test user flow through the UI."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate and interact
        await page.goto("http://localhost:8000")
        await page.click("button[data-testid='login']")
        
        # Assert
        await page.wait_for_selector("text=Dashboard")
        
        await browser.close()
```

---

## CI/CD Integration

**Status:** Not configured

**Recommended Setup:**
1. GitHub Actions workflow
2. Run backend tests on every PR
3. Run integration tests on main branch
4. Generate coverage reports
5. Block merge if tests fail

**Example workflow:**

```yaml
name: Tests
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd backend && pip install -e ".[dev]"
      - run: cd backend && pytest -v
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests fail with DB errors | Check that in-memory DB is being used (conftest.py) |
| Tests fail with auth errors | Verify `auth_client` fixture is being used |
| Tests hang | Check for missing `@pytest.mark.asyncio` decorator |
| Import errors | Ensure backend venv is activated |
| Playwright tests fail | Run `npm install` at repo root |
| MCP test fails | Set `HELM_SESSION_TOKEN` and `OPENROUTER_API_KEY` in `.env` |

---

## Future Improvements

1. **Add frontend test suite** — Jest + React Native Testing Library
2. **Add web admin test suite** — Vitest + React Testing Library
3. **Add E2E test suite** — Playwright with systematic coverage
4. **Add CI/CD pipeline** — GitHub Actions with test automation
5. **Add coverage reporting** — Codecov or similar
6. **Add performance tests** — Load testing with Locust or k6
7. **Add security tests** — OWASP ZAP or similar
8. **Add visual regression tests** — Percy or Chromatic
9. **Add accessibility tests** — axe-core integration
10. **Add mutation testing** — mutmut or similar

---

## Audit History

| Date | Auditor | Status | Notes |
|------|---------|--------|-------|
| 2026-04-16 | reviewer agent | ✅ PASS | 200/200 backend tests passing, web admin fully functional, agent error handling improved |
