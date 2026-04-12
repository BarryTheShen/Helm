"""Regression tests for module and SDUI lifecycle behavior."""

import pytest

pytestmark = pytest.mark.anyio


def assert_normalized_v2_screen(screen: dict, expected_content: str) -> None:
    assert "sections" not in screen
    assert "rows" in screen
    assert len(screen["rows"]) == 1

    row = screen["rows"][0]
    assert "cells" in row
    assert len(row["cells"]) == 1

    cell = row["cells"][0]
    assert "content" in cell
    assert cell["content"]["type"]
    assert cell["content"]["props"]["content"] == expected_content


async def test_custom_module_create_and_delete_lifecycle(auth_client):
    """Custom modules should be created through SDUI CRUD and removed cleanly."""

    create_response = await auth_client.post(
        "/api/sdui/modules",
        json={"name": "Regression Module"},
    )
    assert create_response.status_code == 201

    created_module = create_response.json()
    module_id = created_module["module_id"]
    assert module_id.startswith("custom-regression-module-")
    assert created_module["name"] == "Regression Module"

    modules_response = await auth_client.get("/api/modules")
    assert modules_response.status_code == 200

    modules = modules_response.json()["modules"]
    created_entry = next((module for module in modules if module["id"] == module_id), None)
    assert created_entry is not None
    assert created_entry["name"] == "Regression Module"
    assert created_entry["enabled"] is True

    delete_response = await auth_client.delete(f"/api/sdui/modules/{module_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"module_id": module_id, "deleted": True}

    modules_response = await auth_client.get("/api/modules")
    assert modules_response.status_code == 200
    modules = modules_response.json()["modules"]
    assert all(module["id"] != module_id for module in modules)


async def test_delete_sdui_screen_clears_live_draft_and_config(auth_client):
    """Deleting a module screen should clear live state, draft state, and config."""

    module_id = "delete-everything-module"

    live_screen = {
        "title": "Live Screen",
        "rows": [
            {
                "id": "live-row",
                "cells": [
                    {
                        "id": "live-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Live content"},
                        },
                    }
                ],
            }
        ],
    }
    draft_screen = {
        "title": "Draft Screen",
        "rows": [
            {
                "id": "draft-row",
                "cells": [
                    {
                        "id": "draft-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Draft content"},
                        },
                    }
                ],
            }
        ],
    }

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": True},
    )
    assert config_response.status_code == 200
    assert config_response.json()["auto_approve_drafts"] is True

    set_live_response = await auth_client.post(
        f"/api/sdui/{module_id}",
        json={"screen": live_screen},
    )
    assert set_live_response.status_code == 200
    assert set_live_response.json()["updated"] is True

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": False},
    )
    assert config_response.status_code == 200
    assert config_response.json()["auto_approve_drafts"] is False

    set_draft_response = await auth_client.post(
        f"/api/sdui/{module_id}",
        json={"screen": draft_screen},
    )
    assert set_draft_response.status_code == 200
    assert set_draft_response.json()["draft"] is True

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": True},
    )
    assert config_response.status_code == 200
    assert config_response.json()["auto_approve_drafts"] is True

    delete_response = await auth_client.delete(f"/api/sdui/{module_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"module_id": module_id, "deleted": True}

    live_response = await auth_client.get(f"/api/sdui/{module_id}")
    assert live_response.status_code == 200
    assert live_response.json() == {"screen": None}

    draft_response = await auth_client.get(f"/api/sdui/{module_id}/draft")
    assert draft_response.status_code == 200
    assert draft_response.json() == {"screen": None, "has_draft": False, "version": 0}

    config_response = await auth_client.get(f"/api/sdui/{module_id}/config")
    assert config_response.status_code == 200
    assert config_response.json() == {"auto_approve_drafts": False}


async def test_get_sdui_screen_normalizes_legacy_payload_after_auto_approve(auth_client):
    """Legacy section-based payloads should be returned as V2 rows after live save."""

    module_id = "legacy-live-module"
    legacy_screen = {
        "title": "Legacy Live Screen",
        "sections": [
            {
                "id": "legacy-section-1",
                "components": [
                    {
                        "type": "text",
                        "props": {"content": "Legacy live content"},
                    }
                ],
            }
        ],
    }

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": True},
    )
    assert config_response.status_code == 200

    set_response = await auth_client.post(
        f"/api/sdui/{module_id}",
        json={"screen": legacy_screen},
    )
    assert set_response.status_code == 200
    assert set_response.json()["updated"] is True

    get_response = await auth_client.get(f"/api/sdui/{module_id}")
    assert get_response.status_code == 200

    screen = get_response.json()["screen"]
    assert screen is not None
    assert_normalized_v2_screen(screen, expected_content="Legacy live content")


async def test_get_sdui_screen_normalizes_legacy_payload_after_draft_approval(auth_client):
    """Approving a legacy draft should publish the module in V2 rows and cells format."""

    module_id = "legacy-draft-module"
    legacy_screen = {
        "title": "Legacy Draft Screen",
        "sections": [
            {
                "id": "legacy-section-1",
                "components": [
                    {
                        "type": "text",
                        "props": {"content": "Legacy draft content"},
                    }
                ],
            }
        ],
    }

    set_response = await auth_client.post(
        f"/api/sdui/{module_id}",
        json={"screen": legacy_screen},
    )
    assert set_response.status_code == 200
    assert set_response.json()["draft"] is True

    approve_response = await auth_client.post(f"/api/sdui/{module_id}/draft/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["approved"] is True

    get_response = await auth_client.get(f"/api/sdui/{module_id}")
    assert get_response.status_code == 200

    screen = get_response.json()["screen"]
    assert screen is not None
    assert_normalized_v2_screen(screen, expected_content="Legacy draft content")