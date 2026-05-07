# Migration Notes

## 2026-05-07: Portable AI Instruction Entrypoint

### What Changed

- Created `AGENTS.md` at repo root as primary source of truth for all AI coding agents.
- Rewrote `CLAUDE.md` as a short compatibility wrapper that references `AGENTS.md`.
- Created `docs/ai/` directory with workflow, project map, verification, agent, and migration docs.

### Why

The monolithic `CLAUDE.md` (470+ lines) was Claude Code-specific and not portable across AI tools. This migration:

- Makes instructions tool-agnostic via `AGENTS.md`
- Reduces `CLAUDE.md` to a thin wrapper
- Moves detailed workflow docs into `docs/ai/` for reference
- Preserves all Helm-specific knowledge (no content deleted)

### What Was Fixed

- **Port inconsistency:** README.md incorrectly stated backend port 9100. Actual port is 8000 (confirmed in `config.py`). README, vite config, and package.json scripts all now agree on 8000.
- **File count inflation:** Previous docs had wrong counts (CLAUDE.md: 19 models/17 schemas/19 routers; README: 14 models/15 schemas/15 routers). Verified actual: 25 models, 24 schemas, 25 routers, 15 services, 23 test files.
- **Test count chaos:** README said 113, CLAUDE.md said 200, backend.md said 338. All removed from static docs in favor of live verification commands.
- **Stale path:** `.github/copilot-instructions.md` referenced `docs/code-explanation/` (wrong). Correct is `docs/codebase-explanation/`.

### What Was Left Alone

- `.claude/agents/` — Claude Code-specific agent definitions (kept as-is)
- `.claude/settings.json` — Local permissions config
- `.github/agents/` — Copilot-specific agent definitions
- `.github/instructions/` — File-scoped Copilot instructions
- `.github/skills/` — Reusable agent skills
- Blueprint specs — Authoritative product specs, untouched
- All application source code — Out of scope

## 2026-05-07: Normalize Workflow Verification Rules

### What Changed

- Replaced "Playwright is mandatory for everything" with layer-specific verification rules.
- Replaced the 16-agent mega-loop as the default workflow with task-size workflows.
- Labeled the 16 Claude Code agents as legacy/current Claude Code stack.
- Added target simplified agent roster for future OpenCode config.
- Softened revert rule: wrong approach = revert, small mistake = fix once, no blind patches.
- Docs-only changes no longer require full test suite.
- Removed "docs-updater always last" as a universal rule.

### Future OpenCode Config

Future OpenCode setup should use `AGENTS.md` as the portable instruction file, plus `opencode.jsonc` and `.opencode/` folders following official OpenCode docs. Do not blindly copy `fmflurry/settings-opencode` — borrow patterns, adapt to Helm's context.
