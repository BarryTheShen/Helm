---
description: Fix a bug with reproduce-diagnose-fix-verify loop
agent: helm-build
---

# /helm-bug

Fix a bug using the reproduce → diagnose → fix → verify loop.

## Usage

/helm-bug <description of the bug, error message, or failing behavior>

## What It Does

1. **REPRODUCE** — Write a failing test or create a minimal reproduction. If you can't reproduce it, try harder.
2. **DIAGNOSE** — Read error messages, check logs, trace execution. Identify the root cause, not the symptom.
3. **FIX** — Change only what needs to change. Address the root cause. No patches.
4. **VERIFY** — Run the reproduction. Run the full test suite (`cd backend && pytest -q`). No regressions.
5. If the fix doesn't work or introduces new issues, **revert completely** and try a different approach.

## Rules

- Write the failing test FIRST. The failing test IS the reproduction.
- Backend verification: `cd backend && pytest -q`
- Do not commit until tests pass.
- One bug per invocation. Don't bundle unrelated fixes.
