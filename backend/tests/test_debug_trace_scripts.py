"""FF3-DEBUG-001 — validate debug trace scripts and step-by-step output structure."""

from __future__ import annotations

import importlib.util
import io
import json
import re
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DEBUG_DIR = REPO_ROOT / "debug"

TRACE_SCRIPTS = (
    "trace_template_apply.py",
    "trace_data_source.py",
    "trace_app_preview.py",
)

STEP_PATTERN = re.compile(r"^\[trace\] Step \d+:")


def _load_trace_module(name: str):
    path = DEBUG_DIR / name
    spec = importlib.util.spec_from_file_location(name.removesuffix(".py"), path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("script", TRACE_SCRIPTS)
def test_debug_trace_script_exists(script: str) -> None:
    path = DEBUG_DIR / script
    assert path.is_file(), f"Missing debug script: {path}"


def test_debug_readme_documents_all_trace_scripts() -> None:
    readme = (DEBUG_DIR / "README.md").read_text(encoding="utf-8")
    assert "FF3-DEBUG-001" in readme
    for script in TRACE_SCRIPTS:
        assert script in readme, f"{script} not documented in debug/README.md"
    assert "trace_template_apply.py" in readme
    assert "trace_data_source.py" in readme
    assert "trace_app_preview.py" in readme
    assert "Logs" in readme or "Admin UI" in readme


@pytest.mark.parametrize("script", TRACE_SCRIPTS)
def test_trace_script_imports_and_has_main(script: str) -> None:
    module = _load_trace_module(script)
    assert hasattr(module, "main"), f"{script} must expose main()"
    assert callable(module.main)


@pytest.mark.parametrize("script,extra_args", [
    ("trace_template_apply.py", ["--module", "test_module"]),
    ("trace_data_source.py", []),
    ("trace_app_preview.py", []),
])
def test_trace_script_requires_token_when_run(script: str, extra_args: list[str]) -> None:
    result = subprocess.run(
        [sys.executable, str(DEBUG_DIR / script), *extra_args],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={"HELM_API": "http://127.0.0.1:1", "HELM_TOKEN": ""},
    )
    assert result.returncode == 1
    assert "HELM_TOKEN" in result.stderr or "token" in result.stderr.lower()


def test_trace_data_source_produces_step_by_step_output() -> None:
    """Mock API responses and assert [trace] Step N: structure (FF3-DEBUG-001)."""
    module = _load_trace_module("trace_data_source.py")

    listing = {"items": [{"id": "calendar_events"}, {"id": "todos"}]}
    schema = {"type": "calendar", "schema": {"fields": [{"name": "title"}]}}
    query_result = {"count": 2, "data": [{"title": "Event A"}]}

    payloads = iter([
        json.dumps(listing).encode(),
        json.dumps(schema).encode(),
        json.dumps(query_result).encode(),
    ])

    def fake_urlopen(req, timeout=30):  # noqa: ARG001
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = next(payloads)
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    buf = io.StringIO()
    argv = ["trace_data_source.py", "--source", "calendar_events", "--token", "test-token"]
    with patch.object(module, "urlopen", fake_urlopen), patch.object(sys, "argv", argv):
        with patch("sys.stdout", buf):
            exit_code = module.main()

    output = buf.getvalue()
    assert exit_code == 0
    assert "[trace] Done" in output
    steps = [line for line in output.splitlines() if STEP_PATTERN.match(line)]
    assert len(steps) >= 3, f"Expected ≥3 trace steps, got:\n{output}"
    assert "[trace] Step 1: list data sources" in output
    assert "[trace] Step 2: fetch schema" in output
    assert "[trace] Step 3: query data" in output
    assert "calendar_events" in output


def test_trace_app_preview_produces_step_by_step_output() -> None:
    module = _load_trace_module("trace_app_preview.py")

    apps = {"items": [{"id": "app-1"}]}
    app_detail = {
        "name": "Demo App",
        "bottom_bar_config": [{"module_instance_id": "mod-home"}],
        "launchpad_config": [],
    }
    draft = {"has_draft": True, "dirty": False}
    screen = {"screen": {"rows": [{"id": "r1"}]}}

    payloads = iter([
        json.dumps(apps).encode(),
        json.dumps(app_detail).encode(),
        json.dumps(draft).encode(),
        json.dumps(screen).encode(),
    ])

    def fake_urlopen(req, timeout=30):  # noqa: ARG001
        mock_resp = MagicMock()
        mock_resp.read.return_value = next(payloads)
        mock_resp.__enter__ = lambda s: s
        mock_resp.__exit__ = MagicMock(return_value=False)
        return mock_resp

    buf = io.StringIO()
    argv = ["trace_app_preview.py", "--token", "test-token"]
    with patch.object(module, "urlopen", fake_urlopen), patch.object(sys, "argv", argv):
        with patch("sys.stdout", buf):
            exit_code = module.main()

    output = buf.getvalue()
    assert exit_code == 0
    assert "[trace] Done" in output
    steps = [line for line in output.splitlines() if STEP_PATTERN.match(line)]
    assert len(steps) >= 3
    assert "BrowserPreview" in output or "module=" in output


def test_logs_page_documents_debug_tooling() -> None:
    """Admin Logs page surfaces FF3-DEBUG-001 hints (see web/src/pages/LogsPage.tsx)."""
    logs_page = (REPO_ROOT / "web" / "src" / "pages" / "LogsPage.tsx").read_text(encoding="utf-8")
    assert "FF3-DEBUG-001" in logs_page
    assert "debug/README.md" in logs_page
    assert "trace" in logs_page.lower()
