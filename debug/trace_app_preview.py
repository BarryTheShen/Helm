#!/usr/bin/env python3
"""Trace app preview bundle resolution (FF3-DEBUG-001 / FF4-APP-014).

Usage:
  cd backend && python ../debug/trace_app_preview.py --app <app_id>
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


def _request(method: str, path: str, token: str) -> dict:
    url = f"{DEFAULT_BASE.rstrip('/')}{path}"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    req = Request(url, headers=headers, method=method)
    print(f"[trace] {method} {path}")
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    parser = argparse.ArgumentParser(description="Trace Helm app preview data path")
    parser.add_argument("--app", help="App id (defaults to first app)")
    parser.add_argument("--token", default=DEFAULT_TOKEN)
    args = parser.parse_args()

    if not args.token:
        print("Set HELM_TOKEN or pass --token", file=sys.stderr)
        return 1

    try:
        app_id = args.app
        if not app_id:
            apps = _request("GET", "/api/apps?limit=1", args.token)
            app_id = (apps.get("items") or [{}])[0].get("id")
        if not app_id:
            print("[trace] No apps found", file=sys.stderr)
            return 1

        print(f"[trace] Step 1: load app {app_id}")
        app = _request("GET", f"/api/apps/{app_id}", args.token)
        bottom_bar = app.get("bottom_bar_config") or []
        launchpad = app.get("launchpad_config") or []
        print(f"[trace]   name={app.get('name')} bottom_bar_slots={len(bottom_bar)} launchpad={len(launchpad)}")

        print("[trace] Step 2: load app working draft")
        draft = _request("GET", f"/api/apps/{app_id}/draft", args.token)
        print(f"[trace]   has_draft={draft.get('has_draft')} dirty={draft.get('dirty')}")

        module_ids = [
            slot.get("module_instance_id")
            for slot in bottom_bar
            if slot.get("module_instance_id")
        ]
        print(f"[trace] Step 3: resolve {len(module_ids)} bottom-bar module screens")
        for mod_id in module_ids[:5]:
            screen = _request("GET", f"/api/sdui/{mod_id}", args.token)
            rows = (screen.get("screen") or screen.get("state_json") or {}).get("rows") or []
            print(f"[trace]   module={mod_id} rows={len(rows)}")
    except HTTPError as exc:
        print(f"[trace] HTTP {exc.code}: {exc.read().decode()}", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"[trace] connection failed: {exc.reason}", file=sys.stderr)
        return 1

    print("[trace] Done — BrowserPreview uses the same APIs via web/src/lib/previewResolver.ts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
