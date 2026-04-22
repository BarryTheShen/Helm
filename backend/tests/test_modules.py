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


async def test_pin_module_adds_to_pinned_list(auth_client):
    """Pinning a module should add it to the pinned_modules list."""

    # Get initial modules list
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]

    # Find an unpinned module
    unpinned = next((m for m in modules if not m["pinned"]), None)
    if unpinned is None:
        # All modules are pinned, unpin one first
        pinned = next(m for m in modules if m["pinned"])
        await auth_client.delete(f"/api/modules/{pinned['id']}/pin")
        response = await auth_client.get("/api/modules")
        modules = response.json()["modules"]
        unpinned = next(m for m in modules if not m["pinned"])

    module_id = unpinned["id"]

    # Pin the module
    pin_response = await auth_client.patch(
        f"/api/modules/{module_id}/pin",
        json={}
    )
    assert pin_response.status_code == 200
    assert pin_response.json()["pinned"] is True
    assert pin_response.json()["module_id"] == module_id
    assert "tab_order" in pin_response.json()

    # Verify it's pinned in the modules list
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]

    pinned_module = next(m for m in modules if m["id"] == module_id)
    assert pinned_module["pinned"] is True
    assert pinned_module["tab_order"] >= 0


async def test_pin_module_with_specific_order(auth_client):
    """Pinning a module with tab_order should insert it at that position."""

    # Pin a module at position 2
    module_id = "alerts"

    # First unpin it if it's already pinned
    await auth_client.delete(f"/api/modules/{module_id}/pin")

    # Pin at position 2
    pin_response = await auth_client.patch(
        f"/api/modules/{module_id}/pin",
        json={"tab_order": 2}
    )
    assert pin_response.status_code == 200
    assert pin_response.json()["tab_order"] == 2

    # Verify the order
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]

    pinned_modules = sorted([m for m in modules if m["pinned"]], key=lambda x: x["tab_order"])
    alerts_module = next(m for m in pinned_modules if m["id"] == module_id)
    assert pinned_modules.index(alerts_module) == 2


async def test_unpin_module_removes_from_pinned_list(auth_client):
    """Unpinning a module should remove it from the pinned_modules list."""

    # Get a pinned module
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]

    pinned = next((m for m in modules if m["pinned"]), None)
    if pinned is None:
        # No pinned modules, pin one first
        module_id = "chat"
        await auth_client.patch(f"/api/modules/{module_id}/pin", json={})
        response = await auth_client.get("/api/modules")
        modules = response.json()["modules"]
        pinned = next(m for m in modules if m["pinned"])

    module_id = pinned["id"]

    # Unpin the module
    unpin_response = await auth_client.delete(f"/api/modules/{module_id}/pin")
    assert unpin_response.status_code == 200
    assert unpin_response.json()["pinned"] is False
    assert unpin_response.json()["module_id"] == module_id

    # Verify it's unpinned in the modules list
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]

    unpinned_module = next(m for m in modules if m["id"] == module_id)
    assert unpinned_module["pinned"] is False


async def test_reorder_modules_changes_tab_order(auth_client):
    """Reordering modules should update their tab_order values."""

    # Ensure we have at least 3 pinned modules
    for module_id in ["home", "chat", "calendar"]:
        await auth_client.patch(f"/api/modules/{module_id}/pin", json={})

    # Get current pinned modules
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]
    pinned = [m["id"] for m in modules if m["pinned"]]

    # Reorder them (reverse the list)
    new_order = list(reversed(pinned))
    reorder_response = await auth_client.post(
        "/api/modules/reorder",
        json={"module_ids": new_order}
    )
    assert reorder_response.status_code == 200
    assert reorder_response.json()["pinned_modules"] == new_order

    # Verify the new order
    response = await auth_client.get("/api/modules")
    assert response.status_code == 200
    modules = response.json()["modules"]

    pinned_modules = sorted([m for m in modules if m["pinned"]], key=lambda x: x["tab_order"])
    actual_order = [m["id"] for m in pinned_modules]
    assert actual_order == new_order


async def test_reorder_modules_rejects_invalid_module_id(auth_client):
    """Reordering with an invalid module ID should return 404."""

    reorder_response = await auth_client.post(
        "/api/modules/reorder",
        json={"module_ids": ["home", "invalid-module-id", "chat"]}
    )
    assert reorder_response.status_code == 404
    assert "Unknown module" in reorder_response.json()["detail"]


async def test_reorder_modules_rejects_unpinned_module(auth_client):
    """Reordering with an unpinned module should return 400."""

    # Ensure chat is pinned and alerts is unpinned
    await auth_client.patch("/api/modules/chat/pin", json={})
    await auth_client.delete("/api/modules/alerts/pin")

    # Try to reorder including the unpinned module
    reorder_response = await auth_client.post(
        "/api/modules/reorder",
        json={"module_ids": ["home", "chat", "alerts"]}
    )
    assert reorder_response.status_code == 400
    assert "not pinned" in reorder_response.json()["detail"]


async def test_reorder_modules_rejects_incomplete_list(auth_client):
    """Reordering must include all currently pinned modules."""

    # Ensure we have at least 3 pinned modules
    for module_id in ["home", "chat", "calendar"]:
        await auth_client.patch(f"/api/modules/{module_id}/pin", json={})

    # Get current pinned modules
    response = await auth_client.get("/api/modules")
    modules = response.json()["modules"]
    pinned = [m["id"] for m in modules if m["pinned"]]

    # Try to reorder with only a subset
    incomplete_list = pinned[:2]
    reorder_response = await auth_client.post(
        "/api/modules/reorder",
        json={"module_ids": incomplete_list}
    )
    assert reorder_response.status_code == 400
    assert "must contain all currently pinned modules" in reorder_response.json()["detail"]


async def test_pin_custom_module(auth_client):
    """Custom modules should be pinnable just like built-in modules."""

    # Create a custom module
    create_response = await auth_client.post(
        "/api/sdui/modules",
        json={"name": "Pinnable Custom Module", "icon": "🎯"}
    )
    assert create_response.status_code == 201
    module_id = create_response.json()["module_id"]

    # Pin the custom module
    pin_response = await auth_client.patch(
        f"/api/modules/{module_id}/pin",
        json={}
    )
    assert pin_response.status_code == 200
    assert pin_response.json()["pinned"] is True

    # Verify it's pinned
    response = await auth_client.get("/api/modules")
    modules = response.json()["modules"]
    custom_module = next(m for m in modules if m["id"] == module_id)
    assert custom_module["pinned"] is True

    # Clean up
    await auth_client.delete(f"/api/sdui/modules/{module_id}")