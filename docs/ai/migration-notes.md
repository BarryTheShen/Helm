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

## 2026-05-07: Clean Up AI Workflow Migration Notes

### What Changed

- Renamed Claude Code agent roster section to "Legacy/Current Claude Code Agent Stack" in `docs/ai/agents.md` and `CLAUDE.md`.
- Removed "Standard Pipeline" heading in `CLAUDE.md` — replaced with "Pipeline (Large Features Only)".
- Added explicit Prompt 3 roadmap: project-local OpenCode config using `opencode.jsonc` and `.opencode/agents` + `.opencode/commands`.
- Clarified that we borrow patterns from `fmflurry/settings-opencode`, not blindly copy.
- Verified no suspicious/injection-looking text in new instruction files.

### Future OpenCode Config

Future OpenCode setup should use `AGENTS.md` as the portable instruction file, plus project-local `opencode.jsonc` and `.opencode/` folders (agents, commands), following official OpenCode docs.

## 2026-05-07: Fix OpenCode Config Validity

### What Changed

Rewrote `opencode.jsonc` to match official OpenCode v1.14 config format. Updated all 11 agent files and 8 command files.

### Issues Fixed

- **`contextPaths` → `instructions`:** `contextPaths` is not a recognized OpenCode config key (confirmed via `opencode debug config`). Replaced with `instructions: ["AGENTS.md", "docs/ai/*.md"]`.
- **`${process.env...}` not evaluated:** OpenCode does NOT evaluate JavaScript expressions in config. The literal string was stored as-is. Removed all per-agent model interpolation — model/provider setup deferred to a future prompt.
- **Duplicate agent/command definitions:** Agents and commands were defined in both `opencode.jsonc` AND `.opencode/agents/*.md` / `.opencode/commands/*.md`. OpenCode loads markdown files from `.opencode/` automatically. Removed all agent and command entries from `opencode.jsonc` — it now only contains `$schema`, `model`, `instructions`, and `default_agent`.
- **`helm-build` made primary agent:** Changed `mode: subagent` → `mode: primary`. Set `default_agent: "helm-build"` in config. Removed "Do not fix issues yourself" — the default development agent should fix issues, not just report them.
- **Commands now include `$ARGUMENTS`:** All 8 command markdown files now reference `$ARGUMENTS` so the user's request is passed into the command prompt.
- **`helm-ship` verification is now proportional:** Changed from always running backend tests to running verification proportional to what changed (backend, web, mobile, MCP — based on diff). Added secret scan.
- **Added `$schema` to config.**

### Validation

- `opencode debug config` runs successfully with no errors (OpenCode v1.14).
- 11 agents loaded from `.opencode/agents/*.md` (1 primary, 10 subagent).
- 8 commands loaded from `.opencode/commands/*.md`.
- No app source files changed.

## 2026-05-07: Integrate QA Discovery System

### What Changed

- **Command mismatch fix:** Removed references to non-existent `/helm-tester` and `/helm-protocol` slash commands from `docs/ai/workflows.md`. These are agents only (`helm-tester`, `helm-protocol`) — referenced without the leading `/` to clarify they are not slash commands.
- **Revert discipline restored:** Replaced "revert completely" with "if the approach is wrong, revert; if a small localized mistake, fix it once; do not stack blind patches" in both `docs/ai/workflows.md` and `.opencode/commands/helm-bug.md`.
- **QA discovery system integrated:** Added a new "QA Discovery System" section to `docs/ai/workflows.md` explaining when and how to use `qa/` (test:backend, test:e2e, npm test, run.sh), with caveats about early-stage status and stale e2e selectors.
- **Command docs updated:** `.opencode/commands/helm-bug.md`, `helm-api.md`, `helm-ui.md`, `helm-review.md`, and `helm-ship.md` now include conditional QA check guidance appropriate to their scope.
- **`docs/ai/agents.md` updated:** Replaced stale "Prompt 3 will add..." language with "The OpenCode config lives in..."; added QA suite/discovery capability to `helm-tester` agent description.

### QA Integration Summary

- `qa/src/discover.cjs` documented as discovery/sanity infrastructure (not a test replacement).
- `npm run test:backend` integrated into API workflow and bug fix verification.
- `npm run test:e2e` integrated into UI workflow (with stale selector caveat).
- QA checks in `/helm-ship` are conditional — skipped for docs/config-only changes.
- `/helm-review` can optionally reference QA discovery output as evidence.

### Notes

- QA is early-stage — backend tests are functional, e2e has known stale selectors.
- Failures should be triaged, not blindly treated as app regressions.
- No app source files changed.

## 2026-05-08: Add Local-First OpenCode Model Policy

### What Changed

- Created `docs/ai/opencode-models.md` — local-first model policy for OpenCode.
- Updated `opencode.jsonc` — replaced `"model": "anthropic/claude-sonnet-4-6"` with `"model": "local/qwen3.6-27b-autoround"`.
- Added pointer to `docs/ai/opencode-models.md` in `AGENTS.md` source-of-truth docs table.
- Barry handles provider setup personally; no Claude fallback, no OpenRouter default in repo config.

### Model Policy

- Local model (`qwen3.6-27b-autoround` on `192.168.110.26:8000`) is confirmed reachable.
- All agent roles default to local model.
- OpenCode Go and GitHub Copilot are user-managed optional backups.
- No provider secrets committed; no Claude fallback in repo guidance.
- No app source files changed.
