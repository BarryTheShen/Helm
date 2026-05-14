---
description: Verify branch, tests, diff, and push safety
agent: helm-git
---

# /helm-ship

> This command remains an optional shortcut. It handles branch/diff/verification/push safety when Barry already knows the work is ready to ship. The `helm-orchestrator` can also delegate to `helm-git` when asked to commit/push.

Ship the following work: $ARGUMENTS

## What It Does

1. **Check branch** — Never commit to `main`. Verify current branch is a feature branch.
2. **Check working tree:** `git status -s`
3. **Review changes:** `git diff --stat`
4. **Run verification** proportional to what changed (see `docs/ai/verification.md`):
   - Backend changes: `cd backend && pytest -q`
   - Web changes: `cd web && npm run lint`
   - Mobile changes: `cd mobile && npx expo start`
   - MCP changes: sync check across `tools.py`, `agent_proxy.py`, `server.py`
5. **Conditional QA checks** — not mandatory for every change:
   - API/schema changes: `cd qa && npm run test:backend`
   - Visible web UI changes: `cd qa && npm run test:e2e` (triage stale selector failures); also consider visual/UX review via `helm-ui-reviewer`
   - React/UI diff: `npx -y react-doctor@latest . --diff origin/modernize/import-libraries --offline --json` for hook rule violations, stale closures, render issues
   - Large feature PR readiness: `cd qa && npm test` or `cd qa && bash run.sh`
   - Docs/config only: skip QA
6. **Scan for secrets:** `git diff | grep -iE "api.key|secret|password|token" | grep -v ".env"`
7. **Coverage gate (FF/product-spec work only):** If `.helm-sessions/current/coverage-gate.md` exists:
   - Read `coverage-gate.md` and verify gate status is OPEN.
   - Fail if any must-have (priority `must`) REQ-IDs are NOT TESTED or FAIL with no documented reason.
   - Fail if claimed REQ-IDs in scope lack implementation evidence or a verdict in `product-completeness-matrix.md`.
8. **Reviewer gate:** Require helm-reviewer PASS on feature-completeness matrix, or explicit accepted warnings documented in the session.
9. **React Doctor gate (React/UI changes):** Require React Doctor result (health score + diagnostic summary), or documented skip reason (e.g., no React components changed, pure CSS change).
10. **Stage** reviewed files only.
11. **Commit** with type prefix.
12. **Push** to current branch.

> **WARNING:** The commands below are examples — determine the actual file list and branch name. Do not run placeholders literally.

```bash
git add <reviewed-files>
git commit -m "<type>: <summary>"
git push -u origin <current-branch>
```

## Rules

- **Never** commit directly to `main`. Always work on a feature branch.
- One logical change per commit. Atomic commits.
- Commit messages: imperative mood (`"Add calendar endpoint"`).
- **Never** commit failing tests or broken builds.
- Do not push unrelated commits — only what was verified in this session.
- Do not force push. Do not amend commits without explicit user approval.
- Do not commit secrets, API keys, or `.env` files.

## Agent roles in this workflow
- **helm-git**: Branch safety, diff review, commit, push. Does NOT modify source files.
- **helm-tester** (optional): Run proportional verification. Returns results — does NOT fix.
- **helm-reviewer** (optional): Final quality check. Read-only.
- **helm-security** (optional): Secret scan. Read-only.
- **helm-build** (conditional): Only if verification fails and fixes are needed.

Git agent commits/pushes only after all verification passes and the orchestrator confirms readiness.
