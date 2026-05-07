---
description: Update documentation — run only when docs need updates
agent: helm-docs
---

# /helm-docs

Update documentation for: $ARGUMENTS

## When to Run

This is **conditional** — run only when behavior, API contracts, architecture, or commands have changed. Not every commit needs a docs update.

## Scope

- `docs/ai/` — AI workflow docs
- `docs/codebase-explanation/` — living technical docs
- `README.md` — project readme
- `AGENTS.md` — agent instructions
- `CLAUDE.md` — Claude Code wrapper

## Rules

- Keep file counts and ports current. Remove stale counts in favor of live verification commands.
- Use `docs/codebase-explanation/` as the path (not `docs/code-explanation/`).
- Don't create planning, decision, or analysis documents — work from conversation context.
