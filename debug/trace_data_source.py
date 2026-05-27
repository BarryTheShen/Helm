#!/usr/bin/env python3
"""Trace data source query by stable id (FF3-DEBUG-001).

Usage:
  cd backend && python ../debug/trace_data_source.py --source calendar_events
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
    with urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Trace Helm data source query")
    parser.add_argument("--source", default="calendar_events", help="Data source id (e.g. calendar_events)")
    parser.add_argument("--token", default=DEFAULT_TOKEN)
    args = parser.parse_args()

    if not args.token:
        print("Set HELM_TOKEN or pass --token", file=sys.stderr)
        return 1

    try:
        print("[trace] Step 1: list data sources")
        listing = _request("GET", "/api/data-sources?limit=50", args.token)
        ids = [item.get("id") for item in listing.get("items", [])]
        print(f"[trace]   known ids: {', '.join(ids) or '(none)'}")

        print("[trace] Step 2: fetch schema")
        schema = _request("GET", f"/api/data-sources/{args.source}/schema", args.token)
        print(f"[trace]   type={schema.get('type')} fields={len((schema.get('schema') or {}).get('fields', []))}")

        print("[trace] Step 3: query data")
        result = _request("POST", f"/api/data-sources/{args.source}/query", args.token, {})
        print(f"[trace]   count={result.get('count')} sample={json.dumps((result.get('data') or [])[:1], default=str)}")
    except HTTPError as exc:
        print(f"[trace] HTTP {exc.code}: {exc.read().decode()}", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"[trace] connection failed: {exc.reason}", file=sys.stderr)
        return 1

    print("[trace] Done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
