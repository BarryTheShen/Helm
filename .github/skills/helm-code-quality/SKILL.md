---
name: helm-code-quality
description: Development rules and code quality standards for the Helm project. Points agents to CLAUDE.md for the authoritative rules. Use when implementing, reviewing, or fixing code to ensure compliance with project standards.
---

# Helm Code Quality Standards

All code changes in the Helm project must comply with the rules defined in [CLAUDE.md](../../../CLAUDE.md). This skill summarizes the key rules — but `CLAUDE.md` is the source of truth. Read it when in doubt.

## Core Principles

1. **Root cause fixes only** — Never patch symptoms. Find WHY it broke.
2. **Understand before changing** — Read the full context before modifying any code.
3. **One fix, one concern** — Each change addresses exactly one issue.
4. **No garbage patches** — No workarounds, hacks, or `// TODO: fix later`.

## Bug Handling Loop (Mandatory)

Every bug follows this exact cycle:

1. **REPRODUCE** → Write a failing test or minimal reproduction
2. **DIAGNOSE** → Trace execution, gather evidence, identify root cause
3. **FIX** → Minimal, elegant change targeting root cause
4. **VERIFY** → Run reproduction + full test suite. If it fails: **REVERT completely**, re-diagnose, try different approach
5. **DOCUMENT** → What was the root cause? Why does this fix work?
6. **PREVENT** → Add test to catch this class of bug in future

## Coding Conventions

### Backend (`backend/`)
- Python type hints everywhere (PydanticAI style)
- SQLAlchemy async with UUID string PKs (`str(uuid4())`)
- Pydantic V2 schemas for request/response
- Small focused files — one router per domain, one model per table

### Frontend (`mobile/`)
- TypeScript strict mode
- Functional components only, named exports
- Zustand for state management (4 stores: auth, ui, settings, tabs)
- Expo Router file-based navigation
- Zod `.passthrough()` for WS message validation — never strip unknown fields

### Both
- Meaningful variable/function names — code reads like prose
- Keep functions short — if it needs a comment explaining what it does, split it
- No `console.log` in committed code — use proper logging
- No hardcoded secrets, API keys, or URLs — use env vars

## Review Checklist

Before completing any change, verify:

- [ ] Root cause fix, not symptom patch
- [ ] Downstream impact checked
- [ ] Tests cover the change
- [ ] No duplicated logic
- [ ] Error cases handled
- [ ] Follows existing codebase patterns
- [ ] If MCP tools touched: `mcp/tools.py` and `agent_proxy._get_tool_definitions()` in sync
- [ ] If API changed: backend schemas match frontend types
