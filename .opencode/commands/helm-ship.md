---
description: Verify branch, tests, diff, and push safety
agent: helm-git
---

# /helm-ship

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
   - Visible web UI changes: `cd qa && npm run test:e2e` (triage stale selector failures)
   - Large feature PR readiness: `cd qa && npm test` or `cd qa && bash run.sh`
   - Docs/config only: skip QA
6. **Scan for secrets:** `git diff | grep -iE "api.key|secret|password|token" | grep -v ".env"`
7. **Stage** reviewed files only.
8. **Commit** with type prefix.
9. **Push** to current branch.

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
