#!/usr/bin/env python3
"""PreToolUse guard for OpenCode bash gating migrated to Codex.

Codex CLI 0.137 supports blocking from PreToolUse hooks, but not prompting with
permissionDecision="ask". Patterns that were "ask" in OpenCode are blocked with
an explicit approval message so they are not silently allowed.
"""

from __future__ import annotations

import json
import re
import shlex
import sys
from typing import Any

BLOCK_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bgit\s+push\b", re.I), "OpenCode required approval for git push; ask explicitly before shipping."),
    (re.compile(r"\bgit\s+push\b.*\s--force(?:\s|$)", re.I), "Force-push is blocked by Helm git safety policy."),
    (re.compile(r"\bgit\s+push\b.*\s--force-with-lease(?:\s|$)", re.I), "Force-push is blocked unless Barry explicitly requests it."),
    (re.compile(r"\bgit\s+reset\s+--hard\b", re.I), "Destructive git reset is blocked."),
    (re.compile(r"\bgit\s+checkout\s+--\b", re.I), "Destructive git checkout path restore is blocked."),
    (re.compile(r"\bgit\s+clean\s+-(?:[a-zA-Z]*f[a-zA-Z]*d|[a-zA-Z]*d[a-zA-Z]*f)\b", re.I), "Destructive git clean is blocked."),
    (re.compile(r"\brm\s+-[A-Za-z]*r[A-Za-z]*f\b", re.I), "Recursive force remove is blocked."),
    (re.compile(r"\bsudo\s+rm\b", re.I), "sudo rm is blocked."),
    (re.compile(r"\bmkfs(?:\.[\w-]+)?\b", re.I), "Filesystem formatting commands are blocked."),
    (re.compile(r"\bdd\s+.*\bof=", re.I), "Raw disk writes with dd are blocked."),
]


def _stringify_command(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return " ".join(shlex.quote(str(part)) for part in value)
    return ""


def _extract_command(payload: dict[str, Any]) -> str:
    tool_input = (
        payload.get("tool_input")
        or payload.get("toolInput")
        or payload.get("input")
        or {}
    )
    candidates: list[Any] = [payload.get("command"), payload.get("cmd")]
    if isinstance(tool_input, dict):
        candidates.extend(
            [
                tool_input.get("cmd"),
                tool_input.get("command"),
                tool_input.get("script"),
                tool_input.get("args"),
            ]
        )
    elif isinstance(tool_input, list | str):
        candidates.append(tool_input)
    for candidate in candidates:
        command = _stringify_command(candidate)
        if command:
            return command
    return ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    if not isinstance(payload, dict):
        return 0
    command = _extract_command(payload)
    if not command:
        return 0
    for pattern, reason in BLOCK_PATTERNS:
        if pattern.search(command):
            print(json.dumps({"decision": "block", "reason": reason}))
            print(reason, file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
