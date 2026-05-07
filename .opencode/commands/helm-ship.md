---
description: Verify, commit, and prepare for PR
agent: helm-git
---

# /helm-ship

Verify all tests pass, commit atomic changes, and prepare for PR.

## Usage

/helm-ship <optional: commit message>

## What It Does

1. Run verification: `cd backend && pytest -q`
2. Check working tree: `git status -s`
3. Review changes: `git diff --stat`
4. Stage only relevant files: `git add <specific files>`
5. Commit with type prefix: `git commit -m "<type>: <description>"`
6. Push: `git push -u origin <branch>`

## Rules

- **Never** commit directly to `main`. Always work on a feature branch.
- One logical change per commit. Atomic commits.
- Commit messages: imperative mood (`"Add calendar endpoint"`).
- **Never** commit failing tests or broken builds.
- Do not push unrelated commits — only what was verified in this session.
- Do not force push. Do not amend commits without explicit user approval.
- Do not commit secrets, API keys, or `.env` files.
