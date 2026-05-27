"""Unit tests for validation_service (FF4-VER-006, FF4-VER-007)."""

import pytest

from app.services.validation_service import (
    collect_module_publish_errors,
    format_publish_location_error,
    validate_autosave_config,
    validate_checkpoint_sdui,
    validate_publish_config,
)


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

INVALID_MODULE_SCREEN = {
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
                },
                {
                    "id": "cell-2",
                    "width": 1,
                    "content": {
                        "id": "bad-2",
                        "type": "FakeWidget",
                        "props": {},
                    },
                },
            ],
        },
        {
            "id": "row-2",
            "cells": [
                {
                    "id": "cell-3",
                    "width": 1,
                    "content": {
                        "id": "bad-3",
                        "type": "NotReal",
                        "props": {},
                    },
                }
            ],
        },
    ],
}


def test_format_publish_location_error_includes_module_row_cell_path():
    message = format_publish_location_error(
        "Home Module",
        3,
        1,
        "Unknown component type 'todo'",
        "2026-05-13 09:44",
        "register Todo as a real component, or replace it with a supported component",
    )
    assert "Home Module → Row 3 → Cell 1" in message
    assert "Unknown component type 'todo'" in message
    assert "Home Module version '2026-05-13 09:44'" in message
    assert "Fix: register Todo" in message


def test_collect_module_publish_errors_unknown_type_includes_location():
    errors = collect_module_publish_errors(
        "Home Module",
        "2026-05-13 09:44",
        INVALID_MODULE_SCREEN,
    )
    assert len(errors) == 3
    assert any("Home Module → Row 1 → Cell 1" in err for err in errors)
    assert any("Unknown component type 'todo'" in err for err in errors)
    assert any("Home Module → Row 2 → Cell 1" in err for err in errors)


def test_collect_module_publish_errors_valid_screen_is_empty():
    errors = collect_module_publish_errors(
        "Home Module",
        "v1",
        VALID_MODULE_SCREEN,
    )
    assert errors == []


def test_validate_autosave_config_rejects_catastrophic_shape():
    is_valid, errors = validate_autosave_config({"bottom_bar_config": "not-a-list"})
    assert is_valid is False
    assert "bottom_bar_config must be a list" in errors


def test_validate_autosave_config_allows_incomplete_draft():
    is_valid, errors = validate_autosave_config({"name": "Draft App"})
    assert is_valid is True
    assert errors == []


def test_validate_checkpoint_sdui_accepts_row_first_screen():
    is_valid, errors = validate_checkpoint_sdui(VALID_MODULE_SCREEN)
    assert is_valid is True
    assert errors == []


def test_validate_checkpoint_sdui_rejects_missing_row_id():
    broken = {
        "rows": [
            {
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {"id": "c1", "type": "Text", "props": {"content": "Hi"}},
                    }
                ]
            }
        ]
    }
    is_valid, errors = validate_checkpoint_sdui(broken)
    assert is_valid is False
    assert any("missing 'id'" in err for err in errors)


def test_validate_publish_config_requires_name_and_modules():
    is_valid, errors = validate_publish_config({"bottom_bar_config": [], "launchpad_config": []})
    assert is_valid is False
    assert "App must have a name" in errors
    assert any("at least one module" in err for err in errors)


@pytest.mark.anyio
async def test_validate_publish_modules_reports_missing_version(db_session, test_user):
    from app.models.module_instance import ModuleInstance
    from app.services.validation_service import validate_publish_modules

    instance = ModuleInstance(
        id="mod-no-version",
        user_id=test_user.id,
        module_type="home",
        name="Home Module",
        status="active",
    )
    db_session.add(instance)
    await db_session.commit()

    errors = await validate_publish_modules(
        db_session,
        test_user.id,
        [{"module_id": "mod-no-version", "version_id": None, "status": "no_version"}],
    )
    assert len(errors) == 1
    assert "Home Module" in errors[0]
    assert "create a module checkpoint" in errors[0]
