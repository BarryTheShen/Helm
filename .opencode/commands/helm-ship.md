---
description: Verify, commit, and prepare for PR
agent: helm-git
---

# /helm-ship

Ship the following work: $ARGUMENTS

## What It Does

1. Check branch — never commit to `main`.
2. Check working tree: `git status -s`
3. Review changes: `git diff --stat`
4. Run verification proportional to what changed (see `docs/ai/verification.md`):
   - Backend changes: `cd backend && pytest -q`
   - Web changes: `cd web && npm run lint`
   - Mobile changes: `cd mobile && npx expo start`
   - MCP changes: sync check across tools.py, agent_proxy.py, server.py
5. Scan for secrets: `git diff | grep -iE "api.key|secret|password|token" | grep -v ".env"`
6. Stage only relevant files: `git add <specific files>`
7. Commit with type prefix: `git commit -m "<type>: <description>"`
8. Push: `git push -u origin <branch>`

## Rules

- **Never** commit directly to `main`. Always work on a feature branch.
- One logical change per commit. Atomic commits.
- Commit messages: imperative mood (`"Add calendar endpoint"`).
- **Never** commit failing tests or broken builds.
- Do not push unrelated commits — only what was verified in this session.
- Do not force push. Do not amend commits without explicit user approval.
- Do not commit secrets, API keys, or `.env` files.
