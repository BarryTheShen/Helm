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

## 2026-05-09: Add Automated OpenCode Orchestrator

### What Changed

- Created `.opencode/agents/helm-orchestrator.md` — primary default agent with `permission.task` delegation.
- Changed `opencode.jsonc` — `"default_agent"` from `helm-build` to `helm-orchestrator`.
- Changed `.opencode/agents/helm-build.md` — mode from `primary` to `subagent`; description updated to general implementation worker.
- Created `.opencode/agents/helm-ui-reviewer.md` — multimodal visual review subagent.
- Added `model` fields to all `.opencode/agents/*.md` with tier-based routing (MiMo Pro V2.5 for reasoning agents, DeepSeek V4 Flash for worker agents, Kimi 2.6 for UI reviewer).
- Updated all `.opencode/commands/*.md` — added guidance that commands are optional shortcuts; the default path is to ask `helm-orchestrator`.
- Updated `AGENTS.md` — added "Default OpenCode Orchestration" section.
- Updated `docs/ai/agents.md` — added `helm-orchestrator` as default primary agent, `helm-ui-reviewer` as multimodal reviewer, documented `permission.task` delegation.
- Updated `docs/ai/workflows.md` — clarified that `helm-orchestrator` executes workflows by default.
- Updated `docs/ai/opencode-models.md` — added model tier strategy and agent-to-model mapping table.

### Orchestration Model

- `helm-orchestrator` is the primary default agent.
- Barry does not manually route every step.
- The orchestrator classifies the task, delegates subagents conditionally, verifies, reviews, documents when needed, and reports completion.
- `permission.task` controls delegation: `allow` for automatic subagents, `ask` for security/git.
- Slash commands remain optional shortcuts — they force a specific workflow when Barry already knows the scope.
- No app source files changed.

### Model IDs

- Exact model IDs for MiMo Pro V2.5, DeepSeek V4 Flash, and Kimi 2.6 are **not yet filled** — placeholders in agent files. Barry must run `opencode models` and update.

## 2026-05-10: Finalize OpenCode Go Model Routing

### What Changed

- Replaced all `TODO-*` model placeholders in `.opencode/agents/*.md` with confirmed OpenCode Go model IDs.
- Updated `opencode.jsonc` comments — per-agent model routing is now configured, replaced stale "not configured yet" wording.
- Rewrote `docs/ai/opencode-models.md` — OpenCode Go is the primary daily model source; local Qwen is fallback/private/local.

### Model Mapping

- **Orchestrator** (`helm-orchestrator`) → `opencode-go/deepseek-v4-flash`
- **Reasoning agents** (`helm-planner`, `helm-reviewer`, `helm-security`, `helm-protocol`) → `opencode-go/deepseek-v4-pro`
- **Worker agents** (`helm-build`, `helm-backend`, `helm-frontend`, `helm-agent-runtime`, `helm-tester`, `helm-docs`, `helm-git`) → `opencode-go/deepseek-v4-flash`
- **UI Reviewer** (`helm-ui-reviewer`) → `opencode-go/kimi-k2.6`
- **Local fallback** (`helm-tester` fallback, private/local work) → `local/qwen3.6-27b-autoround`

- No app source files changed.

## 2026-05-10: Tighten Agent Responsibility Boundaries

### What Changed

- Rewrote all 13 `.opencode/agents/*.md` files with a standard 8-section structure: Purpose, When to use, Allowed actions, Forbidden actions, Edit policy, Test/command policy, Output format, Escalation/handoff rules.
- Updated all 8 `.opencode/commands/*.md` files with explicit agent role assignments and "advisory findings" model.
- Updated `docs/ai/agents.md` with comprehensive role matrix (Type, Can edit?, Can run tests?, Can commit/push?, Main responsibility, Explicitly does NOT do) and handoff model.
- Updated `docs/ai/workflows.md` with Agent Handoff Model section describing the standard flow and anti-patterns.
- Tightened `helm-orchestrator` prompt with "What you ARE / What you are NOT / Delegation philosophy" sections — CEO model: delegate everything, read summaries only, give subagents problems not micro-instructions.

### Why

- The tester agent was going beyond testing and fixing errors directly. That was not intended.
- Specialist agents lacked explicit do/don't boundaries and could silently become general implementation agents.
- The orchestrator prompt was too vague about what it should and should not do.
- Commands did not state which agents own edits vs which are advisory.

### Key Boundary Changes

- **helm-tester**: Now explicitly forbidden from fixing application code. Must hand implementation back to build/backend/frontend. May edit test files only if explicitly asked.
- **helm-reviewer**: Read-only by default. Returns findings grouped by severity. Does not apply fixes.
- **helm-security**: Read-only by default. Reports findings. Does not add credentials or provider defaults.
- **helm-orchestrator**: Delegation-only. Does not read source, write code, run tests, fix bugs, or review code. Reads subagent summaries and makes decisions.
- **helm-protocol**: Default read-only. May edit contract/schema files only if explicitly asked.
- **All specialist agents**: Advisory by default. Findings flow to orchestrator → orchestrator delegates fix to implementation agent.

### Anti-patterns eliminated

- Tester auto-fixing errors in "fix all loops"
- Reviewer silently applying patches
- Orchestrator reading source files instead of delegating
- Commands running all agents by default

### What was NOT changed

- `opencode.jsonc` — no config changes needed
- Application source code — out of scope
- `.opencode/` frontmatter (model, mode, permission) — preserved as-is

## 2026-05-13: Refine OpenCode Agent Stack

### What Changed

- **Model routing:** Replaced all `opencode-go/mimo-v2.5-pro` references with `opencode-go/deepseek-v4-flash` (orchestrator) or `opencode-go/deepseek-v4-pro` (planner, plan-critic, reviewer, security, protocol).
- **Reasoning effort:** Added `## Reasoning effort` prompt-level instructions to all 15 agent files — orchestrator uses maximum effort; reasoning agents use high effort with root-cause focus; worker agents use high effort with minimal/proportional action.
- **Orchestrator autonomy:** Added `## Autonomy / ask-less policy` section — orchestrator makes reasonable defaults, asks only for genuine blockers.
- **Planner → critic mandatory:** Added `## Plan Critic Invocation Rules` and `## Scope Control` — critic is mandatory for medium/large/risky plans. Max 2 rounds by default, 3rd only for concrete blockers. Small edits may skip with explicit reason.
- **Plan-critic focus:** Added `## Focus` section — targeted only, max 8 source files, outputs APPROVED or CHANGES_REQUIRED.
- **Session-init permissions:** Locked to `.helm-sessions/` only with specific bash command allowlist. Added `task: deny`.
- **Git safety:** Added `## Safety rules` section with explicit "never push to main" / "never force push" rules.
- **Permission hardening:** Added `task: deny` to all leaf-node agents (13 agents). Only `helm-orchestrator` and `helm-planner` retain task delegation permissions.
- **Docs updates:** `docs/ai/opencode-models.md` rewritten to DeepSeek-first model policy. `docs/ai/agents.md` updated with model routing, reasoning effort policy, orchestrator autonomy. `docs/ai/workflows.md` updated with mandatory critic rules, ask-less policy, and max 2-round critic limit.
- `opencode.jsonc` model changed from `local/qwen3.6-27b-autoround` to `opencode-go/deepseek-v4-flash`.

### Why

- MiMo V2.5 Pro showed runtime looping and overcomplication in Helm's agent context.
- Reasoning effort needed standardization — each agent now has explicit guidance.
- Orchestrator was asking too many routine questions, slowing the loop.
- Planner → critic delegation was optional when it should be mandatory for medium/large work.
- Session-init had overly broad permissions (external_directory: allow).
- Git agent had safety rules in forbidden actions only, not in the prompt body.
- Several agents lacked `task: deny`, allowing potential unauthorized delegation.

### What was NOT changed

- MCP config (Playwright, Context7) in `opencode.jsonc` — untouched.
- Application source code — out of scope.
- Command files (`.opencode/commands/*.md`) — no changes needed.
- `.claude/` files — legacy Claude Code config, left alone.
