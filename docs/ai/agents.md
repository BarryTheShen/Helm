# Agent Definitions

## Legacy/Current Claude Code Agent Stack (16 Agents)

These are the active Claude Code sub-agents defined in `.claude/agents/`. They are **Claude Code-specific** — not portable to other tools. Sub-agents cannot spawn other sub-agents.

| Agent | Model | Scope |
|-------|-------|-------|
| `session-init` | haiku | Session folder creation/archiving |
| `requirements` | sonnet | Maps tasks to affected files via docs |
| `due-diligence` | sonnet | Reads source, outputs compressed context |
| `planner` | sonnet | Generates implementation plans |
| `plan-critic` | sonnet | Challenges plan assumptions |
| `protocol-dev` | sonnet | API/WS/MCP contract definitions |
| `backend-dev` | sonnet | Python FastAPI implementation |
| `frontend-dev` | sonnet | React Native + Web admin |
| `agent-dev` | sonnet | PydanticAI + MCP implementation |
| `tester` | sonnet | pytest-asyncio test writing |
| `live-tester` | sonnet | Playwright functional verification |
| `ui-reviewer` | sonnet | Visual quality review |
| `reviewer` | sonnet | Code quality gate |
| `feature-critic` | sonnet | Large-feature checklist only, not a default agent |
| `docs-updater` | sonnet | Living documentation maintenance — conditional |

These are **not portable** to OpenCode. They remain for Claude Code sessions.

## OpenCode Agent Roster

The OpenCode config lives in `opencode.jsonc` (project settings) and `.opencode/` (agents, commands), following official OpenCode docs.

**Default agent:** `helm-orchestrator` (primary agent, set in `opencode.jsonc`). The orchestrator classifies the task, delegates subagents conditionally, verifies, reviews, documents when needed, and reports completion.

**Final git stage:** `helm-git` is the canonical agent for branch safety, diff review, commit, and push. `/helm-ship` remains as an optional shortcut command but is not the canonical reference.

### Agent Roster

| Agent | Type | Can edit? | Can run tests? | Can commit/push? | Main responsibility | Explicitly does NOT do |
|-------|------|-----------|----------------|------------------|--------------------|-----------------------|
| `helm-orchestrator` | primary | No | No | No | Classify tasks, delegate subagents, verify completion, report | Read source, write code, run tests, call MCP tools directly, explore codebase |
| `helm-session-init` | subagent | Session artifacts only | No | No | Session workspace lifecycle — archive, reset, initialize. For FF sessions, initializes additional artifact stubs (source-index, ledger, audit, slices, qa-plan, matrix, coverage-gate). | Edit app source, run tests, commit |
| `helm-planner` | subagent | Session artifacts only | No | No | Produces plans, invokes plan-critic. For FF work, must invoke helm-requirements-auditor before planning; references REQ-IDs not paraphrases. | Edit app source, broadly explore codebase, run tests, spawn agents other than plan-critic |
| `helm-plan-critic` | subagent | Session artifacts only | No | No | Targeted explorer + plan critic — verifies plan assumptions. For FF work, critiques against requirements-ledger.md; rejects plans without REQ-IDs. | Broad exploration (>8 files), edit source, run tests, spawn subagents (leaf node) |
| `helm-build` | subagent | Yes (backend, frontend, mobile, config) | Yes | No | General implementation worker, routine fixes. For FF work, claims a slice from implementation-slices.md; updates evidence per REQ-ID. | Commit, edit docs/agent-prompts, blindly apply specialist suggestions |
| `helm-backend` | subagent | Yes (backend/ only) | Yes | No | Backend implementation (FastAPI, models, schemas, services) | Edit frontend/mobile/docs, commit, add secrets |
| `helm-frontend` | subagent | Yes (mobile/, web/ only) | Yes | No | Frontend implementation (React Native, web admin) | Edit backend/docs, commit, add secrets |
| `helm-protocol` | subagent | Default: No. Yes if explicitly asked | No | No | API/WS/MCP/SDUI contract alignment | Implement unrelated behavior, edit application logic |
| `helm-agent-runtime` | subagent | Yes (agent/, backend/app/mcp/) | Yes | No | PydanticAI, MCP tools, agent proxy | Alter secrets, add paid providers, edit frontend |
| `helm-tester` | subagent | Test files only (if explicitly asked) | Yes | No | Run the repo's deterministic QA scripts (pytest, Playwright, discover.cjs, React Doctor), diagnose failures, classify root causes, recommend fixes. Does NOT decide product completeness — produces evidence only. For FF work, classifies every in-scope must-have REQ-ID by QA coverage mode; produces qa-plan.md with concrete checks. | Fix application code, auto-fix loops, edit source, decide product completeness |
| `helm-reviewer` | subagent | No | No | No | Code quality, architecture review, feature-completeness verification against requirements-checklist. Checks product completeness against requirements and QA evidence. Does NOT run QA — uses evidence produced by helm-tester. For FF work, product completeness review is primary; produces product-completeness-matrix.md and coverage-gate.md. | Edit files, fix issues, run tests, apply patches, run QA |
| `helm-ui-reviewer` | subagent | No | No | No | Visual/UX review, layout consistency, exhaustive page sweep. Runs for all UI-visible changes. For FF work, adds red-team questions based on original complaint context; verifies realistic user flows. | Edit files, run commands, fix UI issues |
| `helm-docs` | subagent | Yes (docs/, README, AGENTS, CLAUDE) | No | No | Documentation maintenance | Edit app source, run app tests, commit |
| `helm-security` | subagent | Default: No. Narrow fix if asked | No | No | Security audit, secrets detection | Add credentials, add paid providers, fix issues by default |
| `helm-git` | subagent | No | No | Yes (with approval) | Branch management, commit, push | Edit source files, force push, push to main |
| `helm-requirements-auditor` | subagent | Session artifacts only (requirements-ledger.md, requirements-audit.md, implementation-slices.md, source-index.md) | No | No | Compile atomic requirements ledger from full source docs; audit for completeness; produce implementation slices | Implement code, write plans, summarize, edit app source, run tests |

### Agent Details

#### `helm-orchestrator`
- **Mode:** primary
- **Model:** DeepSeek V4 Pro (primary reasoning)
- **Permissions:** All read/edit/bash/glob/grep/lsp/webfetch/websearch/external_directory denied. Only task delegation allowed.
- **Task delegation:** May delegate to all subagents. `helm-security` and `helm-git` require user approval.
- **Cannot:** Read source, edit files, run bash, run tests, call Context7/Playwright directly, explore the codebase.
- **Autonomy:** Autonomous by default — does not stop to ask Barry routine questions. Makes reasonable defaults and only escalates for genuine blockers.

#### `helm-session-init`
- **Purpose:** Manage `.helm-sessions/current/` lifecycle — archive stale sessions, initialize fresh artifacts.
- **On new task:** Move `.helm-sessions/current/` to `.helm-sessions/archive/YYYY-MM-DD-HHMMSS-task-slug/`, create fresh workspace with `task.md` and `context-index.md`.
- **On continuation:** Report existing session state, do not reset.
- **Artifacts:** Creates `task.md`, `context-index.md` on init. `current-plan.md`, `critic-report.md`, `verification-report.md` created conditionally as the loop progresses.
- **For FF sessions:** Initializes additional artifact stubs: `source-index.md`, `requirements-ledger.md`, `requirements-audit.md`, `implementation-slices.md`, `qa-plan.md`, `product-completeness-matrix.md`, `coverage-gate.md`.

#### `helm-planner`
- **Purpose:** Read documentation, produce focused implementation plans, delegate verification to `helm-plan-critic`.
- **Delegate only to:** `helm-plan-critic`. Cannot delegate to any other agent.
- **Process:** Draft plan → write `current-plan.md` → invoke critic → revise based on objections → max 3 rounds → mark APPROVED or UNRESOLVED.
- **For FF work:** Must invoke `helm-requirements-auditor` before planning; references REQ-IDs not paraphrases; lists included and excluded REQ-IDs explicitly.

#### `helm-plan-critic` (combined targeted explorer + critic)
- **Purpose:** Verify plan assumptions by reading only the exact files/symbols needed. Challenges file existence, imports, dependencies, ordering, cross-layer sync, and edge cases.
- **Read limit:** Max 8 source files per invocation.
- **Output:** Writes findings to `critic-report.md`. Returns APPROVED or specific objections with evidence.
- **Leaf node:** Cannot spawn subagents. No broad exploration.
- **For FF work:** Critiques against `requirements-ledger.md`; rejects plans that paraphrase requirements or omit REQ-IDs.

#### `helm-build` / `helm-backend` / `helm-frontend` / `helm-agent-runtime`
Implementation agents. Each owns its domain. See [workflows.md](workflows.md) for routing table.

#### `helm-tester` / `helm-reviewer` / `helm-ui-reviewer` / `helm-security`
Advisory specialists. Produce findings, do not fix by default.

##### `helm-tester`
- **Purpose:** Run the repo's deterministic QA scripts (pytest, Playwright, discover.cjs, React Doctor), diagnose failures, classify root causes, recommend fixes. Does NOT decide product completeness — produces evidence only.
- **Default:** Read-only. Runs tests, inspects output, reports findings. Does not fix application code.
- **For FF work:** Classifies every in-scope must-have REQ-ID by QA coverage mode (automated-test, manual-flow-test, review-only, not-covered, deferred). Produces `qa-plan.md` with concrete checks per REQ-ID.

##### `helm-reviewer`
- **Purpose:** Code quality and architecture review. Verifies implementation completeness against `requirements-checklist.md` — classifies each requirement as PASS, FAIL, PARTIAL, or NOT TESTED. Tests passing is not enough if product requirements are missing.
- **Default:** Read-only. Reports findings grouped by severity. Does not apply fixes.
- **For FF work:** Product completeness review is primary; produces `product-completeness-matrix.md` and `coverage-gate.md`. Product completeness is checked BEFORE code quality.

#### `helm-requirements-auditor`
- **Purpose:** Read-oriented. Reads full source documents (never summaries), atomizes every individual requirement into the requirements ledger, audits for completeness gaps, and produces implementation slices.
- **Model:** `opencode-go/deepseek-v4-pro` (Reasoning tier)
- **Leaf node:** Cannot spawn subagents.
- **Output:** APPROVED (ledger complete and internally consistent) or OBJECTIONS (specific gaps found). Must return APPROVED before the planner may proceed.
- **For FF work:** Compiles `source-index.md`, `requirements-ledger.md`, `requirements-audit.md`, and `implementation-slices.md`. Does not write plans or implement code.

### Handoff Model

Specialist agents (tester, reviewer, security, ui-reviewer) are **advisory by default**. They produce findings, not fixes.

**Standard handoff flow:**
1. Specialist identifies issue → reports finding with file path, line number, diagnosis
2. Orchestrator reads the finding → decides if a fix is needed
3. Orchestrator delegates fix to the appropriate implementation agent (build, backend, frontend, agent-runtime)
4. Implementation agent applies the fix
5. Tester verifies the fix (if behavior changed)
6. Reviewer checks quality (if the change is risky)

**FF/product-spec handoff flow:**
1. Auditor compiles requirements ledger → must return APPROVED before proceeding
2. Planner reads approved ledger → produces plan referencing REQ-IDs
3. Critic validates plan against ledger → rejects paraphrased requirements without REQ-IDs
4. Implementation agent claims one slice from `implementation-slices.md` → implements only those REQ-IDs
5. Tester runs requirement-derived QA per QA mode column in ledger
6. Reviewer produces product-completeness matrix and coverage gate → PRIMARY review gate
7. Coverage gate must be OPEN before shipping — orchestrator delegates fixes or defers requirements if CLOSED

### Depth Policy

The OpenCode agent hierarchy has three layers:

```
Layer 0: helm-orchestrator (primary)
  │
  ├── Layer 1: helm-session-init, helm-planner, helm-build, helm-backend,
  │            helm-frontend, helm-protocol, helm-agent-runtime,
  │            helm-tester, helm-reviewer, helm-ui-reviewer,
  │            helm-docs, helm-security, helm-git,
  │            helm-requirements-auditor
  │
  └── Layer 1: helm-planner
        └── Layer 2: helm-plan-critic (LEAF — no subagents)
```

Rules:
- Orchestrator delegates to depth-1 agents.
- Planner may delegate only to plan-critic.
- Plan-critic is a leaf node — cannot spawn any subagents.
- All other depth-1 agents are leaf nodes for execution.
- There is no separate broad-explorer agent. Plan-critic does targeted exploration only.
- If future evidence proves a separate broad-explorer is needed, add it then. Not now.

### Key Rules

- Tester does NOT fix application code by default
- Reviewer does NOT fix by default
- Security does NOT fix by default
- Git does NOT modify app code
- Only implementation agents (build, backend, frontend, agent-runtime) edit application source
- Planner does NOT broadly explore the codebase — it delegates to plan-critic
- Plan-critic reads MAX 8 source files per invocation
- Orchestrator does NOT read, edit, bash, glob, grep, or call MCP tools directly

The OpenCode config uses `AGENTS.md` (portable instructions), `opencode.jsonc` (project settings), and `.opencode/` (agents, commands).

### helm-tester vs helm-ui-reviewer

- **helm-tester**: Runs automated tests, browser checks, Playwright/e2e, simulator/smoke checks. Diagnoses test failures. Does NOT fix application code. Also runs React Doctor diagnostics on React/React Native component changes — detecting hook rule violations, stale closures, missing dependencies, and render issues. React Doctor complements (does not replace) the existing QA suite.
- **helm-ui-reviewer**: Inspects visual quality, UX consistency, screenshots/browser state, interaction flows, layout, polish. Performs exhaustive page sweep when requested.
- For UI-visible work, both may run:
  - `helm-tester` for automated e2e/smoke/live checks.
  - `helm-ui-reviewer` for visual/UX review and exhaustive page sweep.
- These roles are NOT merged. They are complementary.

### Exhaustive Page Sweep

Exhaustive page sweep is a mode/workflow, not a separate agent. It is the fallback/complement to automated QA:
- **When triggered:** For significant UI pages, central pages (dashboard, editor, preview), when QA is unavailable/stale/flaky, or when Barry requests exhaustive testing.
- **Who runs it:** `helm-ui-reviewer` for visual/UX inspection and `helm-tester` for browser/test execution.
- **What it covers:** Load states, empty/error states, console errors, network failures, all interactions, form validation, navigation, responsive layout, keyboard basics, auth boundaries, data persistence.
- **Output:** Blocking/major/minor issues with reproduction steps and severity classification.

See [workflows.md](workflows.md) for the full exhaustive page sweep policy.

## Model Routing

| Agent | Model Tier | Model ID |
|-------|-----------|----------|
| `helm-orchestrator` | Primary | `opencode-go/deepseek-v4-pro` |
| `helm-planner` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-plan-critic` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-reviewer` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-security` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-protocol` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-ui-reviewer` | Visual/UI | `opencode-go/qwen3.6-plus` |
| `helm-session-init` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-build` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-backend` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-frontend` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-agent-runtime` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-tester` | Worker | `opencode-go/deepseek-v4-flash` (fallback: `local/qwen3.6-27b-autoround`) |
| `helm-docs` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-git` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-requirements-auditor` | Reasoning | `opencode-go/deepseek-v4-pro` |
