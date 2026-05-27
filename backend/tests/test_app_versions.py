"""Tests for app versioning endpoints — publish, checkpoints, canonical flow (FF4-BE-015)."""

import pytest

pytestmark = pytest.mark.anyio

APPS = "/api/apps"
MODULES = "/api/modules"
DEVICES = "/api/devices"

VALID_MODULE_SCREEN = {
    "title": "Home",
    "rows": [
        {
            "id": "row-1",
            "cells": [
                {
                    "id": "cell-1",
                    "width": 1,
                    "content": {
                        "id": "text-1",
                        "type": "Text",
                        "props": {"content": "Hello"},
                    },
                }
            ],
        }
    ],
}


async def test_app_checkpoint_and_list_versions(auth_client):
    app_resp = await auth_client.post(APPS, json={"name": "Versioned App"})
    app_id = app_resp.json()["id"]

    draft_resp = await auth_client.put(
        f"{APPS}/{app_id}/draft",
        json={
            "config_json": {
                "name": "Versioned App",
                "bottom_bar_config": [],
                "launchpad_config": ["module-placeholder"],
            },
            "dirty": True,
        },
    )
    assert draft_resp.status_code == 200

    checkpoint = await auth_client.post(
        f"{APPS}/{app_id}/checkpoints",
        json={"change_summary": "First checkpoint"},
    )
    assert checkpoint.status_code == 200
    version_id = checkpoint.json()["id"]

    versions = await auth_client.get(f"{APPS}/{app_id}/versions")
    assert versions.status_code == 200
    data = versions.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == version_id

    detail = await auth_client.get(f"{APPS}/{app_id}/versions/{version_id}")
    assert detail.status_code == 200
    assert detail.json()["source"] in {"checkpoint", "publish"}


async def test_publish_rejects_unknown_component_with_module_row_cell_path(
    auth_client, db_session,
):
    """FF4-VER-007: publish errors include Module → Row → Cell location strings."""
    from app.models.app import App
    from app.models.app_module_ref import AppModuleRef
    from app.models.app_version import AppVersion
    from app.models.module_instance import ModuleInstance
    from app.models.module_version import ModuleVersion
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="home-mod-publish-err",
        user_id=user.id,
        module_type="home",
        name="Home Module",
        status="active",
    )
    db_session.add(module)

    bad_screen = {
        "title": "Broken",
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "width": 1,
                        "content": {
                            "id": "bad-1",
                            "type": "todo",
                            "props": {},
                        },
                    }
                ],
            }
        ],
    }
    mod_version = ModuleVersion(
        id="mod-ver-bad",
        module_id="home-mod-publish-err",
        user_id=user.id,
        version_number=1,
        display_name="2026-05-13 09:44",
        default_timestamp_name="2026-05-13 09:44",
        sdui_json=bad_screen,
        source="checkpoint",
        validation_status="valid",
    )
    db_session.add(mod_version)
    module.current_version_id = mod_version.id

    app_resp = await auth_client.post(APPS, json={"name": "Publish Fail App"})
    app_id = app_resp.json()["id"]

    ref = AppModuleRef(
        id="ref-publish-err",
        app_id=app_id,
        module_instance_id="home-mod-publish-err",
    )
    db_session.add(ref)

    app_version = AppVersion(
        id="app-ver-publish-err",
        app_id=app_id,
        user_id=user.id,
        version_number=1,
        display_name="v1",
        default_timestamp_name="2026-05-13 09:44",
        config_json={
            "name": "Publish Fail App",
            "bottom_bar_config": [
                {
                    "module_instance_id": "home-mod-publish-err",
                    "module_type": "home",
                    "name": "Home",
                    "icon": "🏠",
                    "slot_position": 0,
                }
            ],
            "launchpad_config": [],
        },
        resolved_module_versions=[],
        module_reference_policies=[],
        source="checkpoint",
        validation_status="valid",
    )
    db_session.add(app_version)
    await db_session.commit()

    resp = await auth_client.post(
        f"{APPS}/{app_id}/versions/{app_version.id}/publish",
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["message"] == "Publish validation failed"
    errors = detail["errors"]
    assert any("Home Module → Row 1 → Cell 1" in err for err in errors)
    assert any("Unknown component type 'todo'" in err for err in errors)
    assert any("2026-05-13 09:44" in err for err in errors)

    app_row = await db_session.get(App, app_id)
    assert app_row.current_published_version_id is None


async def test_canonical_module_app_device_publish_flow(auth_client, db_session):
    """FF4-BE-015: module draft → checkpoint → app checkpoint → publish → device config."""
    from app.models.app_module_ref import AppModuleRef
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="canonical-home",
        user_id=user.id,
        module_type="home",
        name="Home Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    draft = await auth_client.put(
        f"{MODULES}/canonical-home/draft",
        json={"sdui_json": VALID_MODULE_SCREEN, "dirty": True},
    )
    assert draft.status_code == 200

    mod_checkpoint = await auth_client.post(
        f"{MODULES}/canonical-home/checkpoints",
        json={"change_summary": "Module ready"},
    )
    assert mod_checkpoint.status_code == 200

    app_resp = await auth_client.post(APPS, json={"name": "Canonical App"})
    app_id = app_resp.json()["id"]

    ref = AppModuleRef(
        id="ref-canonical",
        app_id=app_id,
        module_instance_id="canonical-home",
    )
    db_session.add(ref)
    await db_session.commit()

    app_draft = await auth_client.put(
        f"{APPS}/{app_id}/draft",
        json={
            "config_json": {
                "name": "Canonical App",
                "bottom_bar_config": [
                    {
                        "module_instance_id": "canonical-home",
                        "module_type": "home",
                        "name": "Home",
                        "icon": "🏠",
                        "slot_position": 0,
                    }
                ],
                "launchpad_config": [],
            },
            "dirty": True,
        },
    )
    assert app_draft.status_code == 200

    app_checkpoint = await auth_client.post(
        f"{APPS}/{app_id}/checkpoints",
        json={"change_summary": "App ready"},
    )
    assert app_checkpoint.status_code == 200
    version_id = app_checkpoint.json()["id"]

    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "canonical-device-uuid", "device_name": "Canonical Phone"},
    )
    assert device_resp.status_code == 201
    device_id = device_resp.json()["id"]

    assign = await auth_client.put(
        f"{DEVICES}/{device_id}/app",
        json={"app_id": app_id},
    )
    assert assign.status_code == 200

    from app.models.device import Device

    device_row = await db_session.get(Device, device_id)
    device_row.installed_runtime_version = "1.0.0"
    device_row.supported_schema_versions = ["2.0"]
    await db_session.commit()

    publish = await auth_client.post(
        f"{APPS}/{app_id}/versions/{version_id}/publish",
    )
    assert publish.status_code == 200
    assert publish.json()["device_count"] == 1

    config = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert config.status_code == 200
    data = config.json()
    assert data["name"] == "Canonical App"
    assert len(data["bottom_bar_config"]) == 1
    assert data["bottom_bar_config"][0]["module_instance_id"] == "canonical-home"

    status = await auth_client.get(f"{DEVICES}/{device_id}/status")
    assert status.status_code == 200
    assert status.json()["active_app_version_id"] == version_id
    assert status.json()["update_status"] == "update_available"


async def test_templates_api_version_endpoints_exist(auth_client):
    """FF4-BE-007 residual: template version CRUD + apply endpoints respond correctly."""
    create = await auth_client.post(
        "/api/templates",
        json={
            "name": "API Surface Template",
            "category": "dashboard",
            "screen_json": VALID_MODULE_SCREEN,
        },
    )
    assert create.status_code == 201
    tid = create.json()["id"]

    versions = await auth_client.get(f"/api/templates/{tid}/versions")
    assert versions.status_code == 200

    ver = await auth_client.post(
        f"/api/templates/{tid}/versions",
        json={"template_json": VALID_MODULE_SCREEN},
    )
    assert ver.status_code == 201
    vid = ver.json()["id"]

    rename = await auth_client.patch(
        f"/api/templates/{tid}/versions/{vid}/rename",
        json={"custom_name": "Renamed Version"},
    )
    assert rename.status_code == 200
    assert rename.json()["custom_name"] == "Renamed Version"
