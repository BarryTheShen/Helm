---
name: helm-code-quality
description: Development rules and code quality standards for the Helm project. Points agents to CLAUDE.md for the authoritative rules. Use when implementing, reviewing, or fixing code to ensure compliance with project standards.
---

# Helm Code Quality Standards

All code changes in the Helm project must comply with the rules defined in CLAUDE.md. This skill summarizes key rules — but CLAUDE.md is the source of truth.

## Core Principles

1. **Root cause fixes only** — Never patch symptoms. Find WHY it broke.
2. **Understand before changing** — Read the full context before modifying code.
3. **One fix, one concern** — Each change addresses exactly one issue.
4. **No garbage patches** — No workarounds, hacks, or `// TODO: fix later`.

## Bug Handling Loop (Mandatory)

1. **REPRODUCE** → Write a failing test or minimal reproduction
2. **DIAGNOSE** → Trace execution, gather evidence, identify root cause
3. **FIX** → Minimal, elegant change targeting root cause
4. **VERIFY** → Run reproduction + full test suite. If fails: **REVERT completely**, re-diagnose
5. **DOCUMENT** → Root cause and why the fix works
6. **PREVENT** → Add test to catch this class of bug

## Coding Conventions

### Backend (`backend/`)
- Python type hints everywhere
- SQLAlchemy async with UUID string PKs
- Pydantic V2 schemas
- Small focused files — one router per domain, one model per table

### Frontend (`mobile/` and `web/`)
- TypeScript strict mode
- Functional components only, named exports
- Zustand for state management
- Zod `.passthrough()` for WS validation — never strip unknown fields

### Both
- Meaningful names — code reads like prose
- Short functions — if it needs a comment, split it
- No `console.log` in committed code
- No hardcoded secrets/keys/URLs

## Review Checklist

- [ ] Root cause fix, not symptom?
- [ ] Could break anything downstream?
- [ ] Tests covering the change?
- [ ] Readable without comments?
- [ ] No duplicated logic?
- [ ] Error cases handled?
- [ ] Follows existing patterns?
