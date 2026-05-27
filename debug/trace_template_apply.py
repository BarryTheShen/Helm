#!/usr/bin/env python3
"""Trace template apply → module draft flow (FF3-DEBUG-001).

Usage:
  cd backend && python ../debug/trace_template_apply.py --template Home --module my_module
  HELM_API=http://localhost:8000 HELM_TOKEN=... python ../debug/trace_template_apply.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_BASE = os.environ.get("HELM_API", "http://localhost:8000")
DEFAULT_TOKEN = os.environ.get("HELM_TOKEN", "")


def _request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    url = f"{DEFAULT_BASE.rstrip('/')}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(url, data=data, headers=headers, method=method)
    print(f"[trace] {method} {path}")
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            parsed = json.loads(raw) if raw else {}
            print(f"[trace]   → {resp.status} OK")
            return parsed
    except HTTPError as exc:
        detail = exc.read().decode()
        print(f"[trace]   → HTTP {exc.code}: {detail}", file=sys.stderr)
        raise
    except URLError as exc:
        print(f"[trace]   → connection failed: {exc.reason}", file=sys.stderr)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Trace Helm template apply flow")
    parser.add_argument("--template", default="Home", help="Template name to apply")
    parser.add_argument("--module", required=True, help="Target module_id")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="Admin bearer token")
    args = parser.parse_args()

    if not args.token:
        print("Set HELM_TOKEN or pass --token (admin session token from web localStorage admin_token)", file=sys.stderr)
        return 1

    print("[trace] Step 1: list templates")
    templates = _request("GET", "/api/templates?limit=100", args.token)
    match = next((t for t in templates.get("items", []) if t.get("name") == args.template), None)
    if not match:
        print(f"[trace] Template '{args.template}' not found", file=sys.stderr)
        return 1
    template_id = match["id"]
    print(f"[trace]   found template id={template_id}")

    print("[trace] Step 2: apply template to module draft")
    apply_result = _request(
        "POST",
        f"/api/templates/{template_id}/apply",
        args.token,
        {"module_id": args.module, "auto_checkpoint": False},
    )
    print(f"[trace]   applied={apply_result.get('applied')}")

    print("[trace] Step 3: read module draft")
    draft = _request("GET", f"/api/sdui/{args.module}/draft", args.token)
    rows = (draft.get("screen") or {}).get("rows") or []
    print(f"[trace]   has_draft={draft.get('has_draft')} row_count={len(rows)}")

    print("[trace] Done — template JSON is in module working draft (publish separately)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
