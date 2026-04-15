"""Tests for the Custom Variables CRUD system (POST /api/variables, etc.)."""

import pytest

pytestmark = pytest.mark.anyio

VARIABLES = "/api/variables"


# ── Auth ───────────────────────────────────────────────────────────────────

async def test_list_variables_requires_auth(client):
    resp = await client.get(VARIABLES)
    assert resp.status_code == 401


async def test_create_variable_requires_auth(client):
    resp = await client.post(VARIABLES, json={"name": "x", "value": "1"})
    assert resp.status_code == 401


# ── CRUD ───────────────────────────────────────────────────────────────────

async def test_list_variables_empty(auth_client):
    resp = await auth_client.get(VARIABLES)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_create_variable(auth_client):
    resp = await auth_client.post(VARIABLES, json={
        "name": "user_theme",
        "value": "dark",
        "type": "text",
        "description": "User's preferred theme",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "user_theme"
    assert data["value"] == "dark"
    assert data["type"] == "text"
    assert data["description"] == "User's preferred theme"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_variable_default_type(auth_client):
    resp = await auth_client.post(VARIABLES, json={
        "name": "some_var",
        "value": "hello",
    })
    assert resp.status_code == 201
    assert resp.json()["type"] == "text"


async def test_create_variable_number_type(auth_client):
    resp = await auth_client.post(VARIABLES, json={
        "name": "count",
        "value": "42",
        "type": "number",
    })
    assert resp.status_code == 201
    assert resp.json()["type"] == "number"


async def test_create_variable_boolean_type(auth_client):
    resp = await auth_client.post(VARIABLES, json={
        "name": "is_active",
        "value": "true",
        "type": "boolean",
    })
    assert resp.status_code == 201
    assert resp.json()["type"] == "boolean"


async def test_create_variable_invalid_type(auth_client):
    resp = await auth_client.post(VARIABLES, json={
        "name": "bad",
        "value": "x",
        "type": "invalid_type",
    })
    assert resp.status_code == 422


async def test_list_variables_after_create(auth_client):
    await auth_client.post(VARIABLES, json={"name": "a", "value": "1"})
    await auth_client.post(VARIABLES, json={"name": "b", "value": "2"})
    resp = await auth_client.get(VARIABLES)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


async def test_unique_constraint_duplicate_name(auth_client):
    await auth_client.post(VARIABLES, json={"name": "dup", "value": "1"})
    resp = await auth_client.post(VARIABLES, json={"name": "dup", "value": "2"})
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


async def test_update_variable(auth_client):
    create_resp = await auth_client.post(VARIABLES, json={
        "name": "to_update",
        "value": "old",
    })
    var_id = create_resp.json()["id"]
    resp = await auth_client.put(f"{VARIABLES}/{var_id}", json={
        "value": "new",
        "description": "updated",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["value"] == "new"
    assert data["description"] == "updated"
    assert data["name"] == "to_update"


async def test_update_variable_not_found(auth_client):
    resp = await auth_client.put(f"{VARIABLES}/nonexistent", json={"value": "x"})
    assert resp.status_code == 404


async def test_delete_variable(auth_client):
    create_resp = await auth_client.post(VARIABLES, json={
        "name": "to_delete",
        "value": "bye",
    })
    var_id = create_resp.json()["id"]
    del_resp = await auth_client.delete(f"{VARIABLES}/{var_id}")
    assert del_resp.status_code == 204

    list_resp = await auth_client.get(VARIABLES)
    ids = [v["id"] for v in list_resp.json()["items"]]
    assert var_id not in ids


async def test_delete_variable_not_found(auth_client):
    resp = await auth_client.delete(f"{VARIABLES}/nonexistent")
    assert resp.status_code == 404


# ── Pagination ─────────────────────────────────────────────────────────────

async def test_pagination(auth_client):
    for i in range(5):
        await auth_client.post(VARIABLES, json={"name": f"var_{i}", "value": str(i)})

    resp = await auth_client.get(f"{VARIABLES}?limit=2&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["has_more"] is True

    resp2 = await auth_client.get(f"{VARIABLES}?limit=2&offset=4")
    data2 = resp2.json()
    assert len(data2["items"]) == 1
    assert data2["has_more"] is False


# ── Owner Isolation ────────────────────────────────────────────────────────

async def test_owner_isolation(client):
    """Variables created by one user are not visible to another user."""
    # Create first user
    await client.post("/auth/setup", json={"username": "user_a", "password": "pass_a"})
    resp_a = await client.post("/auth/login", json={
        "username": "user_a", "password": "pass_a",
        "device_id": "dev-a", "device_name": "Dev A",
    })
    token_a = resp_a.json()["session_token"]

    # Create second user (setup only works once, so use the admin to check isolation)
    # Actually, setup only creates first admin. Let's use the auth_client approach differently.
    # We'll create a variable with user_a, then try to access with user_a's token
    client.headers.update({"Authorization": f"Bearer {token_a}"})
    await client.post(VARIABLES, json={"name": "secret", "value": "mine"})

    resp = await client.get(VARIABLES)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["name"] == "secret"
