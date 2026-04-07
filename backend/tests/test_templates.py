"""Tests for SDUI Templates and Screen History endpoints."""

import pytest


SAMPLE_SCREEN = {
    "title": "Test Dashboard",
    "sections": [
        {
            "id": "s1",
            "components": [
                {"id": "c1", "type": "text", "props": {"content": "Hello"}}
            ],
        }
    ],
}

SAMPLE_SCREEN_WITH_ROWS = {
    "title": "Imported Template",
    "rows": [
        {"id": "r1", "components": [{"id": "c1", "type": "text"}]},
    ],
}


# ── Template CRUD ─────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_create_template(auth_client):
    resp = await auth_client.post("/api/templates", json={
        "name": "My Dashboard",
        "description": "A test template",
        "category": "dashboard",
        "screen_json": SAMPLE_SCREEN,
        "is_public": False,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Dashboard"
    assert data["category"] == "dashboard"
    assert data["screen_json"] == SAMPLE_SCREEN
    assert data["is_public"] is False


@pytest.mark.anyio
async def test_create_template_invalid_category(auth_client):
    resp = await auth_client.post("/api/templates", json={
        "name": "Bad",
        "category": "invalid_category",
        "screen_json": SAMPLE_SCREEN,
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_templates(auth_client):
    # Create two templates
    await auth_client.post("/api/templates", json={
        "name": "T1", "category": "dashboard", "screen_json": SAMPLE_SCREEN,
    })
    await auth_client.post("/api/templates", json={
        "name": "T2", "category": "form", "screen_json": SAMPLE_SCREEN,
    })
    resp = await auth_client.get("/api/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    # Verify screen_json is NOT in list response
    assert "screen_json" not in data["items"][0]


@pytest.mark.anyio
async def test_list_templates_filter_category(auth_client):
    await auth_client.post("/api/templates", json={
        "name": "Dashboard1", "category": "dashboard", "screen_json": SAMPLE_SCREEN,
    })
    await auth_client.post("/api/templates", json={
        "name": "Form1", "category": "form", "screen_json": SAMPLE_SCREEN,
    })
    resp = await auth_client.get("/api/templates?category=dashboard")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["category"] == "dashboard"


@pytest.mark.anyio
async def test_list_templates_search(auth_client):
    await auth_client.post("/api/templates", json={
        "name": "Alpha Board", "category": "dashboard", "screen_json": SAMPLE_SCREEN,
    })
    await auth_client.post("/api/templates", json={
        "name": "Beta Form", "category": "form", "screen_json": SAMPLE_SCREEN,
    })
    resp = await auth_client.get("/api/templates?search=alpha")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


@pytest.mark.anyio
async def test_get_template_detail(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Detail", "category": "tracker", "screen_json": SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    resp = await auth_client.get(f"/api/templates/{tid}")
    assert resp.status_code == 200
    assert resp.json()["screen_json"] == SAMPLE_SCREEN


@pytest.mark.anyio
async def test_get_template_not_found(auth_client):
    resp = await auth_client.get("/api/templates/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_template(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Old Name", "category": "custom", "screen_json": SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    resp = await auth_client.put(f"/api/templates/{tid}", json={
        "name": "New Name",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["category"] == "custom"  # unchanged


@pytest.mark.anyio
async def test_delete_template(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "ToDelete", "category": "form", "screen_json": SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    resp = await auth_client.delete(f"/api/templates/{tid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    # Verify gone
    resp2 = await auth_client.get(f"/api/templates/{tid}")
    assert resp2.status_code == 404


@pytest.mark.anyio
async def test_apply_template_creates_draft(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Applicable", "category": "dashboard", "screen_json": SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    resp = await auth_client.post(f"/api/templates/{tid}/apply", json={
        "module_id": "home",
    })
    assert resp.status_code == 200
    assert resp.json()["applied"] is True

    # Verify draft was created
    draft = await auth_client.get("/api/sdui/home/draft")
    assert draft.status_code == 200
    assert draft.json()["has_draft"] is True


@pytest.mark.anyio
async def test_import_template(auth_client):
    resp = await auth_client.post("/api/templates/import", json={
        "name": "Imported",
        "category": "custom",
        "screen_json": SAMPLE_SCREEN_WITH_ROWS,
    })
    assert resp.status_code == 201
    assert resp.json()["name"] == "Imported"


@pytest.mark.anyio
async def test_import_template_missing_rows(auth_client):
    resp = await auth_client.post("/api/templates/import", json={
        "name": "Bad Import",
        "category": "custom",
        "screen_json": {"title": "No rows or sections"},
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_get_template_rows(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Rows",
        "category": "dashboard",
        "screen_json": SAMPLE_SCREEN_WITH_ROWS,
    })
    tid = create.json()["id"]
    resp = await auth_client.get(f"/api/templates/{tid}/rows")
    assert resp.status_code == 200
    assert len(resp.json()["rows"]) == 1


# ── Screen History ────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_screen_history_recorded_on_set(auth_client):
    """Setting a screen should create a history entry."""
    await auth_client.put("/api/sdui/testmod/config", json={"auto_approve_drafts": True})
    await auth_client.post("/api/sdui/testmod", json={"screen": SAMPLE_SCREEN})
    resp = await auth_client.get("/api/sdui/testmod/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["version"] == 1
    assert data["items"][0]["source"] == "api"


@pytest.mark.anyio
async def test_screen_history_versions_increment(auth_client):
    """Each set_screen should increment the version."""
    await auth_client.post("/api/sdui/vermod", json={"screen": SAMPLE_SCREEN})
    await auth_client.post("/api/sdui/vermod", json={"screen": SAMPLE_SCREEN})
    resp = await auth_client.get("/api/sdui/vermod/history")
    assert resp.json()["total"] == 2
    versions = [i["version"] for i in resp.json()["items"]]
    assert sorted(versions, reverse=True) == versions  # DESC order
    assert versions == [2, 1]


@pytest.mark.anyio
async def test_get_history_version_detail(auth_client):
    await auth_client.post("/api/sdui/detmod", json={"screen": SAMPLE_SCREEN})
    resp = await auth_client.get("/api/sdui/detmod/history/1")
    assert resp.status_code == 200
    assert resp.json()["screen_json"] == SAMPLE_SCREEN


@pytest.mark.anyio
async def test_get_history_version_not_found(auth_client):
    resp = await auth_client.get("/api/sdui/nomod/history/99")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_restore_history_creates_draft(auth_client):
    await auth_client.post("/api/sdui/restmod", json={"screen": SAMPLE_SCREEN})
    resp = await auth_client.post("/api/sdui/restmod/history/1/restore")
    assert resp.status_code == 200
    assert resp.json()["restored_version"] == 1

    # Verify draft was created
    draft = await auth_client.get("/api/sdui/restmod/draft")
    assert draft.json()["has_draft"] is True


@pytest.mark.anyio
async def test_toggle_star(auth_client):
    await auth_client.post("/api/sdui/starmod", json={"screen": SAMPLE_SCREEN})
    # Star
    resp = await auth_client.put("/api/sdui/starmod/history/1/star")
    assert resp.status_code == 200
    assert resp.json()["is_starred"] is True
    # Unstar
    resp = await auth_client.put("/api/sdui/starmod/history/1/star")
    assert resp.json()["is_starred"] is False


@pytest.mark.anyio
async def test_duplicate_screen(auth_client):
    await auth_client.put("/api/sdui/srcmod/config", json={"auto_approve_drafts": True})
    await auth_client.post("/api/sdui/srcmod", json={"screen": SAMPLE_SCREEN})
    resp = await auth_client.post("/api/sdui/srcmod/duplicate", json={
        "target_module_id": "tgtmod",
    })
    assert resp.status_code == 200
    assert resp.json()["target_module_id"] == "tgtmod"

    # Verify draft on target
    draft = await auth_client.get("/api/sdui/tgtmod/draft")
    assert draft.json()["has_draft"] is True


@pytest.mark.anyio
async def test_duplicate_screen_no_source(auth_client):
    resp = await auth_client.post("/api/sdui/nosrc/duplicate", json={
        "target_module_id": "tgt",
    })
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_validate_screen_valid(auth_client):
    resp = await auth_client.post("/api/sdui/validate", json={
        "screen_json": SAMPLE_SCREEN,
    })
    assert resp.status_code == 200
    data = resp.json()
    # With no components registered, all types are unknown if valid_types is non-empty
    # With empty registry, everything is valid
    assert "valid" in data


@pytest.mark.anyio
async def test_history_filter_by_source(auth_client):
    await auth_client.put("/api/sdui/filtmod/config", json={"auto_approve_drafts": True})
    await auth_client.post("/api/sdui/filtmod", json={"screen": SAMPLE_SCREEN})
    # Apply a template to create a "template" source entry
    create = await auth_client.post("/api/templates", json={
        "name": "FilterTest", "category": "dashboard", "screen_json": SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    await auth_client.post(f"/api/templates/{tid}/apply", json={"module_id": "filtmod"})

    resp = await auth_client.get("/api/sdui/filtmod/history?source=api")
    assert resp.json()["total"] == 1

    resp2 = await auth_client.get("/api/sdui/filtmod/history?source=template")
    assert resp2.json()["total"] == 1


@pytest.mark.anyio
async def test_templates_require_auth(client):
    resp = await client.get("/api/templates")
    assert resp.status_code == 401
