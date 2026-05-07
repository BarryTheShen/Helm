---
description: Update documentation
agent: helm-docs
---

# /helm-docs

Maintain project documentation. Edits docs only — no code changes, no bash.

## Usage

/helm-docs <description of what changed, or "update based on git diff">

## Scope

- `docs/ai/` — AI workflow docs
- `docs/codebase-explanation/` — living technical docs
- `README.md` — project readme
- `AGENTS.md` — agent instructions
- `CLAUDE.md` — Claude Code wrapper

## Rules

- Update docs when behavior, API contracts, architecture, or commands change.
- Not every commit needs a docs update — only when something reader-facing has changed.
- Keep file counts and ports current. Remove stale counts in favor of live verification commands.
- Use `docs/codebase-explanation/` as the path (not `docs/code-explanation/`).
