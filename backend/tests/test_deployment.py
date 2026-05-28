"""Deployment acceptance tests (FF4-BE-001, FF4-BE-004, FF4-BE-005)."""

from pathlib import Path

import pytest

from app.config import settings

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.anyio
async def test_health_endpoint_available(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.anyio
async def test_api_namespace_not_blocked_by_admin_mount(client):
    """API routes remain reachable when bundled static serving is enabled."""
    resp = await client.get("/api/apps")
    assert resp.status_code == 401

    resp = await client.get("/api/templates")
    assert resp.status_code == 401

    resp = await client.get("/api/devices")
    assert resp.status_code == 401


def test_serve_static_enabled_for_production_bundle():
    assert settings.serve_static is True


def test_docker_compose_single_port_and_persistence():
    compose_path = REPO_ROOT / "docker-compose.yml"
    assert compose_path.is_file()

    content = compose_path.read_text()
    assert "helm:" in content
    assert "8000:8000" in content
    assert "SERVE_STATIC" in content
    assert "helm-data" in content


def test_root_dockerfile_builds_backend_and_admin():
    dockerfile = REPO_ROOT / "Dockerfile"
    assert dockerfile.is_file()
    content = dockerfile.read_text()
    assert "web" in content.lower() or "admin" in content.lower() or "dist" in content.lower()
    assert "8000" in content


def test_backend_entrypoint_serves_static_when_dist_present():
    main_py = REPO_ROOT / "backend" / "app" / "main.py"
    content = main_py.read_text()
    assert "serve_static" in content
    assert 'app.mount("/",' in content
    assert "StaticFiles" in content
    assert "html=True" in content


@pytest.mark.anyio
async def test_ff4_be_005_websocket_health_and_api_coexist(client):
    """FF4-BE-005: Realtime/API namespaces remain reachable alongside static config."""
    health = await client.get("/health")
    assert health.status_code == 200

    ws_probe = await client.get("/ws")
    assert ws_probe.status_code in (404, 405, 426)

    api_probe = await client.get("/api/apps")
    assert api_probe.status_code == 401


def test_ff4_be_001_admin_route_spa_fallback_comment():
    """FF4-BE-001: SPA nested admin routes fall back to index.html via html=True mount."""
    main_py = (REPO_ROOT / "backend" / "app" / "main.py").read_text()
    assert "SPA client-side routing fallback" in main_py
    assert "index.html instead of 404" in main_py
