---
applyTo: "backend/tests/**/*.py"
---

# Helm Backend — Testing Conventions

## Test Infrastructure

- Framework: pytest + pytest-asyncio
- Database: in-memory SQLite (`sqlite+aiosqlite:///:memory:`)
- Client: `httpx.AsyncClient` with ASGI transport (no real server needed)
- Config: `backend/pyproject.toml` has `[tool.pytest.ini_options]`

## Shared Fixtures (`conftest.py`)

| Fixture | Scope | Provides |
|---------|-------|----------|
| `db_engine` | function | Fresh async engine with all tables created |
| `db_session` | function | AsyncSession bound to the engine |
| `client` | function | Unauthenticated AsyncClient (overrides `get_db`) |
| `auth_client` | function | Pre-authenticated client (creates user + session, sets Bearer token) |

## Writing Tests

### Test File Naming
- One test file per domain: `test_{domain}.py`
- Test functions: `test_{action}_{entity}[_{condition}]`

### Pattern: Setup → Act → Assert
```python
@pytest.mark.anyio
async def test_create_event_returns_201(auth_client):
    response = await auth_client.post("/api/calendar/events", json={
        "title": "Meeting",
        "start_time": "2026-04-01T10:00:00",
        "end_time": "2026-04-01T11:00:00",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Meeting"
```

### Bug Reproduction Tests
When fixing bugs, write the failing test FIRST:
```python
@pytest.mark.anyio
async def test_bug_123_description(auth_client):
    """Reproduces: [description of the bug]"""
    # Setup the exact conditions that trigger the bug
    # Assert the CORRECT behavior (this test should FAIL before the fix)
```

## Running Tests

```bash
cd backend && pytest                    # All tests
cd backend && pytest tests/test_auth.py # Single file
cd backend && pytest -x                 # Stop on first failure
cd backend && pytest -v                 # Verbose output
```
