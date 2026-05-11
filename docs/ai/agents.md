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

### Agent Roster

| Agent | Type | Can edit? | Can run tests? | Can commit/push? | Main responsibility | Explicitly does NOT do |
|-------|------|-----------|----------------|------------------|--------------------|-----------------------|
| `helm-orchestrator` | primary | No | No | No | Classify tasks, delegate subagents, verify completion, report | Read source, write code, run tests, call MCP tools directly, explore codebase |
| `helm-session-init` | subagent | Session artifacts only | No | No | Session workspace lifecycle — archive, reset, initialize | Edit app source, run tests, commit |
| `helm-planner` | subagent | Session artifacts only | No | No | Produces plans, invokes plan-critic | Edit app source, broadly explore codebase, run tests, spawn agents other than plan-critic |
| `helm-plan-critic` | subagent | Session artifacts only | No | No | Targeted explorer + plan critic — verifies plan assumptions | Broad exploration (>8 files), edit source, run tests, spawn subagents (leaf node) |
| `helm-build` | subagent | Yes (backend, frontend, mobile, config) | Yes | No | General implementation worker, routine fixes | Commit, edit docs/agent-prompts, blindly apply specialist suggestions |
| `helm-backend` | subagent | Yes (backend/ only) | Yes | No | Backend implementation (FastAPI, models, schemas, services) | Edit frontend/mobile/docs, commit, add secrets |
| `helm-frontend` | subagent | Yes (mobile/, web/ only) | Yes | No | Frontend implementation (React Native, web admin) | Edit backend/docs, commit, add secrets |
| `helm-protocol` | subagent | Default: No. Yes if explicitly asked | No | No | API/WS/MCP/SDUI contract alignment | Implement unrelated behavior, edit application logic |
| `helm-agent-runtime` | subagent | Yes (agent/, backend/app/mcp/) | Yes | No | PydanticAI, MCP tools, agent proxy | Alter secrets, add paid providers, edit frontend |
| `helm-tester` | subagent | Test files only (if explicitly asked) | Yes | No | Run tests, diagnose failures, recommend fixes | Fix application code, auto-fix loops, edit source |
| `helm-reviewer` | subagent | No | No | No | Code quality and architecture review | Edit files, fix issues, run tests, apply patches |
| `helm-ui-reviewer` | subagent | No | No | No | Visual/screenshot review, layout consistency | Edit files, run commands, fix UI issues |
| `helm-docs` | subagent | Yes (docs/, README, AGENTS, CLAUDE) | No | No | Documentation maintenance | Edit app source, run app tests, commit |
| `helm-security` | subagent | Default: No. Narrow fix if asked | No | No | Security audit, secrets detection | Add credentials, add paid providers, fix issues by default |
| `helm-git` | subagent | No | No | Yes (with approval) | Branch management, commit, push | Edit source files, force push, push to main |

### Agent Details

#### `helm-orchestrator`
- **Mode:** primary
- **Model:** MiMo V2.5 Pro
- **Permissions:** All read/edit/bash/glob/grep/lsp/webfetch/websearch/external_directory denied. Only task delegation allowed.
- **Task delegation:** May delegate to all subagents. `helm-security` and `helm-git` require user approval.
- **Cannot:** Read source, edit files, run bash, run tests, call Context7/Playwright directly, explore the codebase.

#### `helm-session-init`
- **Purpose:** Manage `.helm-sessions/current/` lifecycle — archive stale sessions, initialize fresh artifacts.
- **On new task:** Move `.helm-sessions/current/` to `.helm-sessions/archive/<timestamp>-<slug>/`, create fresh workspace with `task.md` and `context-index.md`.
- **On continuation:** Report existing session state, do not reset.
- **Artifacts:** Creates `task.md`, `context-index.md` on init. `current-plan.md`, `critic-report.md`, `verification-report.md` created conditionally as the loop progresses.

#### `helm-planner`
- **Purpose:** Read documentation, produce focused implementation plans, delegate verification to `helm-plan-critic`.
- **Delegate only to:** `helm-plan-critic`. Cannot delegate to any other agent.
- **Process:** Draft plan → write `current-plan.md` → invoke critic → revise based on objections → max 3 rounds → mark APPROVED or UNRESOLVED.

#### `helm-plan-critic` (combined targeted explorer + critic)
- **Purpose:** Verify plan assumptions by reading only the exact files/symbols needed. Challenges file existence, imports, dependencies, ordering, cross-layer sync, and edge cases.
- **Read limit:** Max 8 source files per invocation.
- **Output:** Writes findings to `critic-report.md`. Returns APPROVED or specific objections with evidence.
- **Leaf node:** Cannot spawn subagents. No broad exploration.

#### `helm-build` / `helm-backend` / `helm-frontend` / `helm-agent-runtime`
Implementation agents. Each owns its domain. See [workflows.md](workflows.md) for routing table.

#### `helm-tester` / `helm-reviewer` / `helm-ui-reviewer` / `helm-security`
Advisory specialists. Produce findings, do not fix by default.

### Handoff Model

Specialist agents (tester, reviewer, security, ui-reviewer) are **advisory by default**. They produce findings, not fixes.

**Standard handoff flow:**
1. Specialist identifies issue → reports finding with file path, line number, diagnosis
2. Orchestrator reads the finding → decides if a fix is needed
3. Orchestrator delegates fix to the appropriate implementation agent (build, backend, frontend, agent-runtime)
4. Implementation agent applies the fix
5. Tester verifies the fix (if behavior changed)
6. Reviewer checks quality (if the change is risky)

### Depth Policy

The OpenCode agent hierarchy has three layers:

```
Layer 0: helm-orchestrator (primary)
  │
  ├── Layer 1: helm-session-init, helm-planner, helm-build, helm-backend,
  │            helm-frontend, helm-protocol, helm-agent-runtime,
  │            helm-tester, helm-reviewer, helm-ui-reviewer,
  │            helm-docs, helm-security, helm-git
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

## Model Routing

| Agent | Model Tier | Model ID |
|-------|-----------|----------|
| `helm-orchestrator` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-planner` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-plan-critic` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-reviewer` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-security` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-protocol` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-ui-reviewer` | Multimodal | `opencode-go/kimi-k2.6` |
| `helm-session-init` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-build` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-backend` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-frontend` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-agent-runtime` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-tester` | Worker | `opencode-go/deepseek-v4-flash` (fallback: `local/qwen3.6-27b-autoround`) |
| `helm-docs` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-git` | Worker | `opencode-go/deepseek-v4-flash` |
