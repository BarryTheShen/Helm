---
description: Fix a bug with reproduce-diagnose-fix-verify loop
agent: helm-build
---

# /helm-bug

Fix the following bug: $ARGUMENTS

## What It Does

1. **REPRODUCE** — Write a failing test or create a minimal reproduction. If you can't reproduce it, try harder.
2. **DIAGNOSE** — Read error messages, check logs, trace execution. Identify the root cause, not the symptom.
3. **FIX** — Change only what needs to change. Address the root cause. No patches.
4. **VERIFY** — Run the reproduction. Run the relevant test suite per `docs/ai/verification.md`. No regressions.
5. If the fix doesn't work or introduces new issues, **revert completely** and try a different approach.

## Rules

- Write the failing test FIRST. The failing test IS the reproduction.
- Backend verification: `cd backend && pytest -q`
- Web verification: `cd web && npm run lint` (if web layer involved)
- Do not commit until all tests pass.
- One bug per invocation. Don't bundle unrelated fixes.
