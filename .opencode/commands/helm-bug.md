---
description: Fix a bug with reproduce-diagnose-fix-verify loop
agent: helm-build
---

# /helm-bug

> This command is an optional shortcut. The default path is to ask `helm-orchestrator` normally — it will classify the task and route accordingly. Use this command when you already know it is a bug fix.

Fix the following bug: $ARGUMENTS

## What It Does

**Agent assignments:** The `helm-build` (or `helm-backend`/`helm-frontend`/`helm-agent-runtime`) agent applies the fix. `helm-tester` is used for reproduction and diagnosis, but must NOT fix the bug directly. After the fix, `helm-tester` verifies the fix.

1. **REPRODUCE** — Write a failing test or create a minimal reproduction. If you can't reproduce it, try harder.
2. **DIAGNOSE** — Read error messages, check logs, trace execution. Identify the root cause, not the symptom.
3. **FIX** — Change only what needs to change. Address the root cause. No patches.
4. **VERIFY** — Run the reproduction. Run the relevant test suite per `docs/ai/verification.md`. No regressions.
5. If the approach is wrong, revert. If verification reveals a small localized mistake, fix it once. Do not stack blind patches.

## Rules

- Write the failing test FIRST. The failing test IS the reproduction.
- Backend verification: `cd backend && pytest -q`
- Web verification: `cd web && npm run lint` (if web layer involved)
- If the bug affects API behavior, also run `cd qa && npm run test:backend`.
- If the bug affects visible web UI, also run `cd qa && npm run test:e2e` (note: e2e has known stale selectors — triage failures).
- Do not commit until all tests pass.
- One bug per invocation. Don't bundle unrelated fixes.

## Agent roles in this workflow
- **helm-tester**: Reproduce the bug, write failing test, diagnose root cause. Returns findings — does NOT fix.
- **helm-build / helm-backend / helm-frontend**: Apply the fix based on tester's diagnosis.
- **helm-tester** (again): Verify the fix passes the failing test.
- **helm-reviewer** (optional): Review the fix for quality if the change is risky.
