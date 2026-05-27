"""Tests for SDUI Templates and Screen History endpoints."""

from sqlalchemy import select

import pytest

from app.models.template import SDUITemplate
from app.services.sdui_state import validate_sdui_screen_payload
from app.services.template_seed import SEED_TEMPLATES


LEGACY_SAMPLE_SCREEN = {
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

NORMALIZED_LEGACY_SAMPLE_SCREEN = {
    "title": "Test Dashboard",
    "sections": [
        {
            "id": "s1",
            "components": [
                {"id": "c1", "type": "Text", "props": {"content": "Hello"}}
            ],
        }
    ],
}

VALID_ROW_FIRST_SCREEN = {
    "title": "Imported Template",
    "rows": [
        {
            "id": "row-1",
            "cells": [
                {
                    "id": "cell-1",
                    "width": 1,
                    "content": {
                        "id": "content-1",
                        "type": "Text",
                        "props": {"content": "Hello rows"},
                    },
                }
            ],
        },
    ],
}

INVALID_ROW_FIRST_SCREEN = {
    "title": "Broken Template",
    "rows": [
        {
            "cells": [
                {
                    "id": "cell-1",
                    "content": {
                        "type": "Text",
                        "props": {"content": "Missing row id"},
                    },
                }
            ]
        }
    ],
}


# ── Template CRUD ─────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_create_template(auth_client):
    resp = await auth_client.post("/api/templates", json={
        "name": "My Dashboard",
        "description": "A test template",
        "category": "dashboard",
        "screen_json": LEGACY_SAMPLE_SCREEN,
        "is_public": False,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Dashboard"
    assert data["category"] == "dashboard"
    assert data["screen_json"] == NORMALIZED_LEGACY_SAMPLE_SCREEN
    assert data["is_public"] is False


@pytest.mark.anyio
async def test_create_template_rejects_invalid_row_first_payload(auth_client):
    resp = await auth_client.post("/api/templates", json={
        "name": "Broken",
        "category": "dashboard",
        "screen_json": INVALID_ROW_FIRST_SCREEN,
    })

    assert resp.status_code == 422
    assert "missing 'id'" in resp.json()["detail"]


@pytest.mark.anyio
async def test_create_template_invalid_category(auth_client):
    resp = await auth_client.post("/api/templates", json={
        "name": "Bad",
        "category": "invalid_category",
        "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_list_templates(auth_client):
    # Create two templates
    await auth_client.post("/api/templates", json={
        "name": "T1", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    await auth_client.post("/api/templates", json={
        "name": "T2", "category": "form", "screen_json": LEGACY_SAMPLE_SCREEN,
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
        "name": "Dashboard1", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    await auth_client.post("/api/templates", json={
        "name": "Form1", "category": "form", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    resp = await auth_client.get("/api/templates?category=dashboard")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["category"] == "dashboard"


@pytest.mark.anyio
async def test_list_templates_search(auth_client):
    await auth_client.post("/api/templates", json={
        "name": "Alpha Board", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    await auth_client.post("/api/templates", json={
        "name": "Beta Form", "category": "form", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    resp = await auth_client.get("/api/templates?search=alpha")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


@pytest.mark.anyio
async def test_get_template_detail(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Detail", "category": "tracker", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    resp = await auth_client.get(f"/api/templates/{tid}")
    assert resp.status_code == 200
    assert resp.json()["screen_json"] == NORMALIZED_LEGACY_SAMPLE_SCREEN


@pytest.mark.anyio
async def test_get_template_not_found(auth_client):
    resp = await auth_client.get("/api/templates/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_update_template(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Old Name", "category": "custom", "screen_json": LEGACY_SAMPLE_SCREEN,
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
        "name": "ToDelete", "category": "form", "screen_json": LEGACY_SAMPLE_SCREEN,
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
        "name": "Applicable", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
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
async def test_apply_template_rejects_invalid_row_first_payload(auth_client, db_session):
    create = await auth_client.post("/api/templates", json={
        "name": "Broken Apply",
        "category": "dashboard",
        "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]

    result = await db_session.execute(select(SDUITemplate).where(SDUITemplate.id == tid))
    template = result.scalar_one()
    template.screen_json = INVALID_ROW_FIRST_SCREEN
    await db_session.commit()

    resp = await auth_client.post(f"/api/templates/{tid}/apply", json={
        "module_id": "home",
    })

    assert resp.status_code == 422
    assert "missing 'id'" in resp.json()["detail"]

    draft = await auth_client.get("/api/sdui/home/draft")
    assert draft.status_code == 200
    assert draft.json() == {"screen": None, "has_draft": False, "version": 0}


# ── Template Version Apply ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_apply_template_version_creates_draft(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Versioned", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]

    # Create a version
    ver = await auth_client.post(f"/api/templates/{tid}/versions", json={
        "template_json": LEGACY_SAMPLE_SCREEN,
    })
    assert ver.status_code == 201
    vid = ver.json()["id"]

    # Apply the version
    resp = await auth_client.post(f"/api/templates/{tid}/versions/{vid}/apply", json={
        "module_id": "vapply",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["applied"] is True
    assert data["version_id"] == vid
    assert data["template_id"] == tid
    assert data["module_id"] == "vapply"

    # Verify draft was created
    draft = await auth_client.get("/api/sdui/vapply/draft")
    assert draft.status_code == 200
    assert draft.json()["has_draft"] is True
    screen = draft.json()["screen"]
    assert screen is not None
    # The legacy sections format gets normalized to row-first by validate_sdui_screen_payload
    assert "rows" in screen or "sections" in screen


@pytest.mark.anyio
async def test_apply_template_version_not_found(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "NotFound", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]

    resp = await auth_client.post(f"/api/templates/{tid}/versions/nonexistent/apply", json={
        "module_id": "home",
    })
    assert resp.status_code == 404
    assert "Version not found" in resp.json()["detail"]


@pytest.mark.anyio
async def test_apply_template_version_template_not_found(auth_client):
    resp = await auth_client.post("/api/templates/badid/versions/nonexistent/apply", json={
        "module_id": "home",
    })
    assert resp.status_code == 404
    assert "Template not found" in resp.json()["detail"]


@pytest.mark.anyio
async def test_apply_template_version_rejects_invalid_payload(auth_client, db_session):
    from sqlalchemy import select
    from app.models.template_version import TemplateVersion

    create = await auth_client.post("/api/templates", json={
        "name": "BrokenVer", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]

    # Create a version with valid JSON first
    ver = await auth_client.post(f"/api/templates/{tid}/versions", json={
        "template_json": LEGACY_SAMPLE_SCREEN,
    })
    vid = ver.json()["id"]

    # Mutate the version's template_json to be invalid
    result = await db_session.execute(
        select(TemplateVersion).where(TemplateVersion.id == vid)
    )
    version = result.scalar_one()
    version.template_json = INVALID_ROW_FIRST_SCREEN
    await db_session.commit()

    resp = await auth_client.post(f"/api/templates/{tid}/versions/{vid}/apply", json={
        "module_id": "vapply",
    })
    assert resp.status_code == 422
    assert "missing 'id'" in resp.json()["detail"]

    # Verify no draft was created
    draft = await auth_client.get("/api/sdui/vapply/draft")
    assert draft.status_code == 200
    assert draft.json()["has_draft"] is False


@pytest.mark.anyio
async def test_apply_template_version_with_row_first_payload(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "RowVer", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]

    ver = await auth_client.post(f"/api/templates/{tid}/versions", json={
        "template_json": VALID_ROW_FIRST_SCREEN,
    })
    vid = ver.json()["id"]

    resp = await auth_client.post(f"/api/templates/{tid}/versions/{vid}/apply", json={
        "module_id": "vrowapply",
    })
    assert resp.status_code == 200
    assert resp.json()["applied"] is True

    draft = await auth_client.get("/api/sdui/vrowapply/draft")
    assert draft.status_code == 200
    assert draft.json()["has_draft"] is True


@pytest.mark.anyio
async def test_apply_template_version_requires_auth(client):
    resp = await client.post("/api/templates/fake/versions/fake/apply", json={
        "module_id": "home",
    })
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_apply_template_version_records_history(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "HistVer", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    tid = create.json()["id"]
    ver = await auth_client.post(f"/api/templates/{tid}/versions", json={
        "template_json": LEGACY_SAMPLE_SCREEN,
    })
    vid = ver.json()["id"]

    await auth_client.post(f"/api/templates/{tid}/versions/{vid}/apply", json={
        "module_id": "vhist",
    })

    history = await auth_client.get("/api/sdui/vhist/history")
    assert history.status_code == 200
    data = history.json()
    assert data["total"] == 1
    assert data["items"][0]["source"] == "template_version"


@pytest.mark.anyio
async def test_import_template(auth_client):
    resp = await auth_client.post("/api/templates/import", json={
        "name": "Imported",
        "category": "custom",
        "screen_json": LEGACY_SAMPLE_SCREEN,
    })
    assert resp.status_code == 201
    assert resp.json()["name"] == "Imported"
    assert resp.json()["screen_json"] == NORMALIZED_LEGACY_SAMPLE_SCREEN


@pytest.mark.anyio
async def test_import_template_rejects_invalid_row_first_payload(auth_client):
    resp = await auth_client.post("/api/templates/import", json={
        "name": "Broken Import",
        "category": "custom",
        "screen_json": INVALID_ROW_FIRST_SCREEN,
    })

    assert resp.status_code == 422
    assert "missing 'id'" in resp.json()["detail"]


@pytest.mark.anyio
async def test_import_template_missing_rows_normalizes_to_empty_legacy_sections(auth_client):
    resp = await auth_client.post("/api/templates/import", json={
        "name": "Bad Import",
        "category": "custom",
        "screen_json": {"title": "No rows or sections"},
    })

    assert resp.status_code == 201
    assert resp.json()["screen_json"] == {
        "title": "No rows or sections",
        "sections": [],
    }


@pytest.mark.anyio
async def test_get_template_rows(auth_client):
    create = await auth_client.post("/api/templates", json={
        "name": "Rows",
        "category": "dashboard",
        "screen_json": VALID_ROW_FIRST_SCREEN,
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
    await auth_client.post("/api/sdui/testmod", json={"screen": LEGACY_SAMPLE_SCREEN})
    resp = await auth_client.get("/api/sdui/testmod/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["version"] == 1
    assert data["items"][0]["source"] == "api"


@pytest.mark.anyio
async def test_screen_history_versions_increment(auth_client):
    """Each set_screen should increment the version."""
    await auth_client.post("/api/sdui/vermod", json={"screen": LEGACY_SAMPLE_SCREEN})
    await auth_client.post("/api/sdui/vermod", json={"screen": LEGACY_SAMPLE_SCREEN})
    resp = await auth_client.get("/api/sdui/vermod/history")
    assert resp.json()["total"] == 2
    versions = [i["version"] for i in resp.json()["items"]]
    assert sorted(versions, reverse=True) == versions  # DESC order
    assert versions == [2, 1]


@pytest.mark.anyio
async def test_get_history_version_detail(auth_client):
    await auth_client.post("/api/sdui/detmod", json={"screen": LEGACY_SAMPLE_SCREEN})
    resp = await auth_client.get("/api/sdui/detmod/history/1")
    assert resp.status_code == 200
    assert resp.json()["screen_json"] == NORMALIZED_LEGACY_SAMPLE_SCREEN


@pytest.mark.anyio
async def test_get_history_version_not_found(auth_client):
    resp = await auth_client.get("/api/sdui/nomod/history/99")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_restore_history_creates_draft(auth_client):
    await auth_client.post("/api/sdui/restmod", json={"screen": LEGACY_SAMPLE_SCREEN})
    resp = await auth_client.post("/api/sdui/restmod/history/1/restore")
    assert resp.status_code == 200
    assert resp.json()["restored_version"] == 1

    # Verify draft was created
    draft = await auth_client.get("/api/sdui/restmod/draft")
    assert draft.json()["has_draft"] is True


@pytest.mark.anyio
async def test_toggle_star(auth_client):
    await auth_client.post("/api/sdui/starmod", json={"screen": LEGACY_SAMPLE_SCREEN})
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
    await auth_client.post("/api/sdui/srcmod", json={"screen": LEGACY_SAMPLE_SCREEN})
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
async def test_validate_screen_validates_row_first_contract(auth_client):
    resp = await auth_client.post("/api/sdui/validate", json={
        "screen_json": VALID_ROW_FIRST_SCREEN,
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data == {
        "valid": True,
        "errors": [],
        "component_count": 1,
    }


@pytest.mark.anyio
async def test_validate_screen_reports_row_first_errors(auth_client):
    resp = await auth_client.post("/api/sdui/validate", json={
        "screen_json": INVALID_ROW_FIRST_SCREEN,
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert any("missing 'id'" in error for error in data["errors"])
    assert data["component_count"] == 1


@pytest.mark.anyio
async def test_history_filter_by_source(auth_client):
    await auth_client.put("/api/sdui/filtmod/config", json={"auto_approve_drafts": True})
    await auth_client.post("/api/sdui/filtmod", json={"screen": LEGACY_SAMPLE_SCREEN})
    # Apply a template to create a "template" source entry
    create = await auth_client.post("/api/templates", json={
        "name": "FilterTest", "category": "dashboard", "screen_json": LEGACY_SAMPLE_SCREEN,
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


@pytest.mark.anyio
async def test_seed_templates_are_valid_and_applyable(auth_client):
    """FF4-TPL-001: seed template JSON validates and applies to a module draft."""
    create_module = await auth_client.post("/api/sdui/modules", json={"name": "Seed Target", "icon": "📦"})
    assert create_module.status_code == 201, create_module.text
    module_id = create_module.json()["module_id"]

    for seed in SEED_TEMPLATES:
        _, errors = validate_sdui_screen_payload(seed["screen_json"])
        assert errors == [], f"Seed template {seed['name']} has validation errors: {errors}"

        create = await auth_client.post("/api/templates", json={
            "name": f"QA {seed['name']} {seed['category']}",
            "category": seed["category"],
            "screen_json": seed["screen_json"],
        })
        assert create.status_code == 201, create.text
        tid = create.json()["id"]

        apply_resp = await auth_client.post(f"/api/templates/{tid}/apply", json={
            "module_id": module_id,
            "auto_checkpoint": False,
        })
        assert apply_resp.status_code == 200, apply_resp.text
        assert apply_resp.json()["applied"] is True

        draft = await auth_client.get(f"/api/sdui/{module_id}/draft")
        assert draft.status_code == 200
        assert draft.json()["has_draft"] is True
        assert isinstance(draft.json()["screen"], dict)
        assert len(draft.json()["screen"].get("rows", [])) > 0
