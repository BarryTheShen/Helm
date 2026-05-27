"""FF4 Phase 9 — App Editor PARTIAL REQ closure tests."""

import pytest

from tests.test_app_versions import VALID_MODULE_SCREEN

pytestmark = pytest.mark.anyio

APPS = "/api/apps"
DEVICES = "/api/devices"
MODULES = "/api/modules"


async def _create_app_with_module(auth_client, db_session):
    """Create app + home module + device assignment scaffolding."""
    from app.models.app_module_ref import AppModuleRef
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="phase9-home",
        user_id=user.id,
        module_type="home",
        name="Home Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    draft = await auth_client.put(
        f"{MODULES}/phase9-home/draft",
        json={"sdui_json": VALID_MODULE_SCREEN, "dirty": True},
    )
    assert draft.status_code == 200

    mod_checkpoint = await auth_client.post(
        f"{MODULES}/phase9-home/checkpoints",
        json={"change_summary": "Module ready"},
    )
    assert mod_checkpoint.status_code == 200

    app_resp = await auth_client.post(APPS, json={"name": "Phase 9 App", "icon": "star"})
    app_id = app_resp.json()["id"]

    ref = AppModuleRef(
        id="ref-phase9",
        app_id=app_id,
        module_instance_id="phase9-home",
    )
    db_session.add(ref)
    await db_session.commit()

    return app_id, "phase9-home"


async def test_app_draft_save_persists_to_backend(auth_client, db_session):
    """FF4-APP-002: App Editor draft save is stored and readable via GET /draft."""
    app_id, _module_id = await _create_app_with_module(auth_client, db_session)

    payload = {
        "config_json": {
            "name": "Updated Draft Name",
            "icon": "heart",
            "dark_mode": True,
            "module_icons": {"phase9-home": "star"},
            "bottom_bar_config": [],
            "launchpad_config": [],
        },
        "dirty": True,
    }
    save = await auth_client.put(f"{APPS}/{app_id}/draft", json=payload)
    assert save.status_code == 200

    draft = await auth_client.get(f"{APPS}/{app_id}/draft")
    assert draft.status_code == 200
    data = draft.json()["config_json"]
    assert data["name"] == "Updated Draft Name"
    assert data["dark_mode"] is True
    assert data["module_icons"]["phase9-home"] == "star"


async def test_module_draft_change_does_not_update_device_until_app_publish(
    auth_client, db_session,
):
    """FF4-APP-005: module draft edits do not change assigned device config until app publish."""
    app_id, module_id = await _create_app_with_module(auth_client, db_session)

    app_draft = await auth_client.put(
        f"{APPS}/{app_id}/draft",
        json={
            "config_json": {
                "name": "Phase 9 App",
                "bottom_bar_config": [
                    {
                        "module_instance_id": module_id,
                        "module_type": "home",
                        "name": "Home",
                        "icon": "home",
                        "slot_position": 0,
                    }
                ],
                "launchpad_config": [],
            },
            "dirty": True,
        },
    )
    assert app_draft.status_code == 200

    checkpoint = await auth_client.post(
        f"{APPS}/{app_id}/checkpoints",
        json={"change_summary": "Initial publish"},
    )
    assert checkpoint.status_code == 200
    version_id = checkpoint.json()["id"]

    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "phase9-device-uuid", "device_name": "Phase 9 Phone"},
    )
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

    config_before = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert config_before.status_code == 200
    assert config_before.json()["name"] == "Phase 9 App"

    module_edit = await auth_client.put(
        f"{MODULES}/{module_id}/draft",
        json={"sdui_json": {**VALID_MODULE_SCREEN, "title": "Changed Module Title"}, "dirty": True},
    )
    assert module_edit.status_code == 200

    config_after_module_edit = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert config_after_module_edit.status_code == 200
    assert config_after_module_edit.json()["name"] == "Phase 9 App"


async def test_device_app_preview_creates_session(auth_client, db_session):
    """FF4-APP-015: App Editor device preview creates preview session on device."""
    app_id, _module_id = await _create_app_with_module(auth_client, db_session)

    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "phase9-preview-uuid", "device_name": "Preview Phone"},
    )
    device_id = device_resp.json()["id"]

    preview = await auth_client.post(
        f"{APPS}/{app_id}/preview/device",
        json={"device_id": device_id},
    )
    assert preview.status_code == 200
    session = preview.json()
    assert session["target_type"] == "mobile_device"
    assert session["device_id"] == device_id
    assert session["status"] == "active"

    from app.models.device import Device

    device_row = await db_session.get(Device, device_id)
    assert device_row.preview_session_id == session["id"]


async def test_device_config_serves_published_version_snapshot(auth_client, db_session):
    """FF4-APP-018: device config serves published AppVersion snapshot (offline-safe source)."""
    app_id, module_id = await _create_app_with_module(auth_client, db_session)

    await auth_client.put(
        f"{APPS}/{app_id}/draft",
        json={
            "config_json": {
                "name": "Published Snapshot",
                "dark_mode": False,
                "bottom_bar_config": [
                    {
                        "module_instance_id": module_id,
                        "module_type": "home",
                        "name": "Home",
                        "icon": "home",
                        "slot_position": 0,
                    }
                ],
                "launchpad_config": [],
            },
            "dirty": True,
        },
    )

    checkpoint = await auth_client.post(
        f"{APPS}/{app_id}/checkpoints",
        json={"change_summary": "Snapshot"},
    )
    version_id = checkpoint.json()["id"]

    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "phase9-offline-uuid", "device_name": "Offline Phone"},
    )
    device_id = device_resp.json()["id"]
    await auth_client.put(f"{DEVICES}/{device_id}/app", json={"app_id": app_id})

    from app.models.device import Device

    device_row = await db_session.get(Device, device_id)
    device_row.installed_runtime_version = "1.0.0"
    device_row.supported_schema_versions = ["2.0"]
    await db_session.commit()

    publish = await auth_client.post(f"{APPS}/{app_id}/versions/{version_id}/publish")
    assert publish.status_code == 200

    config = await auth_client.get(f"{DEVICES}/{device_id}/config")
    assert config.status_code == 200
    assert config.json()["name"] == "Published Snapshot"

    status = await auth_client.get(f"{DEVICES}/{device_id}/status")
    assert status.status_code == 200
    assert status.json()["active_app_version_id"] == version_id


async def test_device_render_error_reported_and_listed_for_admin(auth_client, db_session):
    """FF4-APP-024: device render errors are stored and listed for admin UI."""
    app_id, _module_id = await _create_app_with_module(auth_client, db_session)

    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "phase9-error-uuid", "device_name": "Barry's iPhone"},
    )
    device_id = device_resp.json()["id"]
    await auth_client.put(f"{DEVICES}/{device_id}/app", json={"app_id": app_id})

    report = await auth_client.post(
        f"{DEVICES}/{device_id}/error",
        json={
            "error_type": "render_error",
            "error_message": "Barry's iPhone failed to update: Unsupported component type 'ArticleCard'.",
            "error_details": {
                "unsupported_type": "ArticleCard",
                "installed_runtime": "1.0.0",
                "required_runtime": "1.2.0",
            },
        },
    )
    assert report.status_code == 201

    listed = await auth_client.get(f"{DEVICES}/errors?app_id={app_id}")
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total"] >= 1
    assert any("Barry's iPhone" in item["error_message"] for item in payload["items"])
    assert payload["items"][0]["device_name"] == "Barry's iPhone"

    status = await auth_client.get(f"{DEVICES}/{device_id}/status")
    assert status.json()["update_status"] == "error"


async def test_preview_session_error_logged(auth_client, db_session):
    """FF4-APP-025: preview session failures are logged for admin review."""
    app_id, _module_id = await _create_app_with_module(auth_client, db_session)

    device_resp = await auth_client.post(
        DEVICES,
        json={"device_id": "phase9-preview-fail-uuid", "device_name": "Preview Fail Phone"},
    )
    device_id = device_resp.json()["id"]

    preview = await auth_client.post(
        f"{APPS}/{app_id}/preview/device",
        json={"device_id": device_id},
    )
    session_id = preview.json()["id"]

    error = await auth_client.post(
        f"/api/modules/preview-sessions/{session_id}/error",
        json={
            "error_type": "preview_failure",
            "error_message": "Preview render failed on device",
            "device_id": device_id,
        },
    )
    assert error.status_code == 201
    assert error.json()["source"] == "preview_session"
    assert error.json()["preview_session_id"] == session_id
