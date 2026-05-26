# /helm-docs

> This command is an optional shortcut. The default path is to ask `helm-orchestrator` normally — it will invoke the docs agent when behavior/API/architecture has changed. Use this command for targeted docs updates.

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

## Agent roles in this workflow
- **helm-docs**: Updates documentation. Edits docs files only.

No implementation agents needed. No test execution for docs-only changes.
