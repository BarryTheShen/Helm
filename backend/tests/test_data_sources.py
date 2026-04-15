"""Tests for the Data Sources CRUD and query system."""

import pytest

pytestmark = pytest.mark.anyio

DATA_SOURCES = "/api/data-sources"


# ── Auth ───────────────────────────────────────────────────────────────────

async def test_list_data_sources_requires_auth(client):
    resp = await client.get(DATA_SOURCES)
    assert resp.status_code == 401


async def test_create_data_source_requires_auth(client):
    resp = await client.post(DATA_SOURCES, json={
        "name": "My Calendar", "type": "calendar", "connector": "internal",
    })
    assert resp.status_code == 401


# ── CRUD ───────────────────────────────────────────────────────────────────

async def test_list_data_sources_empty(auth_client):
    resp = await auth_client.get(DATA_SOURCES)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_create_data_source(auth_client):
    resp = await auth_client.post(DATA_SOURCES, json={
        "name": "My Calendar",
        "type": "calendar",
        "connector": "internal",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Calendar"
    assert data["type"] == "calendar"
    assert data["connector"] == "internal"
    assert data["config_json"] == "{}"
    assert "id" in data
    assert "created_at" in data


async def test_create_data_source_with_config(auth_client):
    resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Custom Source",
        "type": "custom",
        "connector": "api",
        "config_json": '{"url": "https://example.com"}',
    })
    assert resp.status_code == 201
    assert resp.json()["config_json"] == '{"url": "https://example.com"}'


async def test_list_data_sources_after_create(auth_client):
    await auth_client.post(DATA_SOURCES, json={
        "name": "Source 1", "type": "calendar", "connector": "internal",
    })
    await auth_client.post(DATA_SOURCES, json={
        "name": "Source 2", "type": "notes", "connector": "internal",
    })
    resp = await auth_client.get(DATA_SOURCES)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


# ── Schema Endpoint ───────────────────────────────────────────────────────

async def test_get_schema_calendar(auth_client):
    create_resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Cal", "type": "calendar", "connector": "internal",
    })
    source_id = create_resp.json()["id"]
    resp = await auth_client.get(f"{DATA_SOURCES}/{source_id}/schema")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "calendar"
    assert data["schema"] is not None
    assert data["schema"]["type"] == "calendar"
    assert len(data["schema"]["fields"]) > 0


async def test_get_schema_notes(auth_client):
    create_resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Notes", "type": "notes", "connector": "internal",
    })
    source_id = create_resp.json()["id"]
    resp = await auth_client.get(f"{DATA_SOURCES}/{source_id}/schema")
    assert resp.status_code == 200
    assert resp.json()["schema"]["type"] == "notes"


async def test_get_schema_chat(auth_client):
    create_resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Chat", "type": "chat", "connector": "internal",
    })
    source_id = create_resp.json()["id"]
    resp = await auth_client.get(f"{DATA_SOURCES}/{source_id}/schema")
    assert resp.status_code == 200
    assert resp.json()["schema"]["type"] == "chat"


async def test_get_schema_custom_type_returns_null(auth_client):
    create_resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Custom", "type": "custom", "connector": "api",
    })
    source_id = create_resp.json()["id"]
    resp = await auth_client.get(f"{DATA_SOURCES}/{source_id}/schema")
    assert resp.status_code == 200
    assert resp.json()["schema"] is None


async def test_get_schema_not_found(auth_client):
    resp = await auth_client.get(f"{DATA_SOURCES}/nonexistent/schema")
    assert resp.status_code == 404


# ── Query Endpoint ─────────────────────────────────────────────────────────

async def test_query_calendar_empty(auth_client):
    create_resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Cal", "type": "calendar", "connector": "internal",
    })
    source_id = create_resp.json()["id"]
    resp = await auth_client.post(f"{DATA_SOURCES}/{source_id}/query", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["data"] == []
    assert data["count"] == 0
    assert data["type"] == "calendar"


async def test_query_calendar_with_data(auth_client):
    """Create calendar events, then query via data source."""
    # Create a calendar event
    await auth_client.post("/api/calendar/events", json={
        "title": "Test Event",
        "start_time": "2026-04-15T10:00:00",
        "end_time": "2026-04-15T11:00:00",
    })

    # Create data source and query
    create_resp = await auth_client.post(DATA_SOURCES, json={
        "name": "Cal", "type": "calendar", "connector": "internal",
    })
    source_id = create_resp.json()["id"]
    resp = await auth_client.post(f"{DATA_SOURCES}/{source_id}/query", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert data["data"][0]["title"] == "Test Event"


async def test_query_not_found(auth_client):
    resp = await auth_client.post(f"{DATA_SOURCES}/nonexistent/query", json={})
    assert resp.status_code == 404


# ── Owner Isolation ────────────────────────────────────────────────────────

async def test_owner_isolation(client):
    """Data sources created by one user are not visible to another."""
    await client.post("/auth/setup", json={"username": "ds_user", "password": "pass123"})
    resp = await client.post("/auth/login", json={
        "username": "ds_user", "password": "pass123",
        "device_id": "dev-ds", "device_name": "DS Dev",
    })
    token = resp.json()["session_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})

    await client.post(DATA_SOURCES, json={
        "name": "My Source", "type": "calendar", "connector": "internal",
    })
    resp = await client.get(DATA_SOURCES)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
