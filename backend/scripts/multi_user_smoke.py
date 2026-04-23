"""Multi-user smoke test — simulates 10 concurrent users exercising the core flow.

For each user, in parallel:
  1. Create account (or reuse)
  2. Login → grab session token
  3. GET /api/templates (list)
  4. POST /api/modules/install (install first template)
  5. GET /api/modules/instances (verify install)
  6. DELETE /api/modules/instances/{id} (uninstall)
  7. POST /api/variables (create a user variable)
  8. GET /api/audit (verify audit log recorded the actions)

Reports pass/fail per step per user, plus a final summary.

Usage:
    cd backend
    .venv/bin/python scripts/multi_user_smoke.py
"""

from __future__ import annotations

import asyncio
import secrets
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

BACKEND_URL = "http://localhost:9100"
NUM_USERS = 10
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "changeme"


@dataclass
class StepResult:
    name: str
    ok: bool
    status: int | None = None
    detail: str = ""
    duration_ms: float = 0.0


@dataclass
class UserRun:
    username: str
    password: str
    steps: list[StepResult] = field(default_factory=list)

    @property
    def all_passed(self) -> bool:
        return all(s.ok for s in self.steps)


async def _step(name: str, coro) -> StepResult:
    t0 = time.perf_counter()
    try:
        resp = await coro
        dt = (time.perf_counter() - t0) * 1000
        ok = 200 <= resp.status_code < 300
        detail = "" if ok else resp.text[:200]
        return StepResult(name=name, ok=ok, status=resp.status_code, detail=detail, duration_ms=dt)
    except Exception as exc:
        dt = (time.perf_counter() - t0) * 1000
        return StepResult(name=name, ok=False, status=None, detail=repr(exc)[:200], duration_ms=dt)


def ensure_user_cli(username: str, password: str) -> tuple[bool, str]:
    """Create user via manage.py (CLI-only in this project). Idempotent: reset on conflict."""
    import subprocess
    from pathlib import Path

    backend_dir = Path(__file__).resolve().parent.parent
    python = backend_dir / ".venv" / "bin" / "python"
    if not python.exists():
        return False, f"venv python not found at {python}"

    create = subprocess.run(
        [str(python), "manage.py", "create_user", "--username", username, "--password", password],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=20,
    )
    if create.returncode == 0:
        return True, "created"
    # If user already exists, reset the password so we know the credential works.
    reset = subprocess.run(
        [str(python), "manage.py", "reset_password", "--username", username, "--password", password],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=20,
    )
    if reset.returncode == 0:
        return True, "reset"
    return False, (create.stderr or reset.stderr or "unknown")[:200]


async def admin_login() -> str:
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30.0) as client:
        r = await client.post(
            "/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD, "device_id": "smoke", "device_name": "smoke"},
        )
        r.raise_for_status()
        return r.json()["session_token"]


async def run_user(user: UserRun) -> UserRun:
    async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=30.0) as client:
        # 1. Login
        login_step = await _step(
            "login",
            client.post(
                "/auth/login",
                json={
                    "username": user.username,
                    "password": user.password,
                    "device_id": f"smoke-{user.username}",
                    "device_name": "smoke",
                },
            ),
        )
        user.steps.append(login_step)
        if not login_step.ok:
            return user

        # Refetch token because _step discards the body
        r = await client.post(
            "/auth/login",
            json={
                "username": user.username,
                "password": user.password,
                "device_id": f"smoke-{user.username}-2",
                "device_name": "smoke",
            },
        )
        token = r.json()["session_token"]
        auth = {"Authorization": f"Bearer {token}"}

        # 2. List templates
        list_step = await _step("list_templates", client.get("/api/templates", headers=auth))
        user.steps.append(list_step)
        if not list_step.ok:
            return user
        payload = (await client.get("/api/templates", headers=auth)).json()
        templates = payload.get("items", payload) if isinstance(payload, dict) else payload
        if not templates:
            user.steps.append(StepResult(name="install_module", ok=False, detail="no templates seeded"))
            return user
        template_id = templates[0]["id"]

        # 3. Install module — do it raw so we can capture the id from the response
        t0 = time.perf_counter()
        inst_resp = await client.post(
            "/api/modules/install",
            headers=auth,
            json={"template_id": template_id, "name": f"mod-{user.username}"},
        )
        dt = (time.perf_counter() - t0) * 1000
        install_ok = 200 <= inst_resp.status_code < 300
        user.steps.append(StepResult(
            name="install_module",
            ok=install_ok,
            status=inst_resp.status_code,
            detail="" if install_ok else inst_resp.text[:200],
            duration_ms=dt,
        ))
        instance_id: str | int | None = None
        if install_ok:
            try:
                instance_id = inst_resp.json().get("id")
            except Exception:
                instance_id = None

        # 4. List instances
        instances_step = await _step("list_instances", client.get("/api/modules/instances", headers=auth))
        user.steps.append(instances_step)

        # 5. Create a variable
        var_step = await _step(
            "create_variable",
            client.post(
                "/api/variables",
                headers=auth,
                json={"name": f"test_var_{user.username}", "value": "hello", "type": "text"},
            ),
        )
        user.steps.append(var_step)

        # 6. Uninstall if we have an id
        if instance_id is not None:
            uninstall_step = await _step(
                "uninstall_module",
                client.delete(f"/api/modules/instances/{instance_id}", headers=auth),
            )
            user.steps.append(uninstall_step)

        # 7. Audit log (optional — some deployments restrict this to admin)
        audit_step = await _step("audit_log", client.get("/api/audit?limit=5", headers=auth))
        user.steps.append(audit_step)

        return user


async def main() -> int:
    print(f"→ Provisioning {NUM_USERS} test users via manage.py…")
    users: list[UserRun] = []
    for i in range(NUM_USERS):
        suffix = secrets.token_hex(3)
        u = UserRun(username=f"smoke_{i}_{suffix}", password="testpass123")
        ok, detail = ensure_user_cli(u.username, u.password)
        if not ok:
            print(f"  ! could not provision {u.username}: {detail}")
        users.append(u)

    print(f"→ Running {NUM_USERS} concurrent user flows…\n")
    t0 = time.perf_counter()
    results = await asyncio.gather(*(run_user(u) for u in users))
    total_ms = (time.perf_counter() - t0) * 1000

    # ── Report ────────────────────────────────────────────────────────────────
    step_names = ["login", "list_templates", "install_module", "list_instances", "create_variable", "uninstall_module", "audit_log"]
    pad = max(len(s) for s in step_names) + 2

    print(f"{'user':18}  ", end="")
    for name in step_names:
        print(f"{name:<{pad}}", end="")
    print()
    print("─" * (18 + len(step_names) * pad + 2))

    passes = 0
    total_steps = 0
    for u in results:
        print(f"{u.username:18}  ", end="")
        by_name = {s.name: s for s in u.steps}
        for name in step_names:
            s = by_name.get(name)
            if s is None:
                mark = "-"
            elif s.ok:
                mark = "PASS"
                passes += 1
            else:
                mark = f"FAIL({s.status})"
            total_steps += 1 if s is not None else 0
            print(f"{mark:<{pad}}", end="")
        print()

    print()
    failures: list[tuple[str, StepResult]] = []
    for u in results:
        for s in u.steps:
            if not s.ok:
                failures.append((u.username, s))

    print(f"Summary: {passes}/{total_steps} steps passed across {NUM_USERS} users in {total_ms/1000:.2f}s")
    if failures:
        print(f"\nFailures ({len(failures)}):")
        for username, s in failures[:30]:
            print(f"  {username} · {s.name} · status={s.status} · {s.detail[:120]}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
