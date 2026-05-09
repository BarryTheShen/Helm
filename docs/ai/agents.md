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
| `reviewer` | sonnet | Code quality gate — now includes feature-validator checklist |
| `feature-critic` | sonnet | Large-feature checklist only, not a default agent |
| `docs-updater` | sonnet | Living documentation maintenance — conditional |

Copilot-compatible agent definitions live in `.github/agents/` (18 files). These are tool-specific and not portable.

## Target OpenCode Agent Roster

The OpenCode config lives in `opencode.jsonc` (project settings) and `.opencode/` (agents, commands), following official OpenCode docs. We borrowed patterns from `fmflurry/settings-opencode`, not blindly copying it.

**Default agent:** `helm-orchestrator` (primary agent, set in `opencode.jsonc`). Barry does not manually route every step — the orchestrator classifies the task, delegates subagents conditionally, verifies, reviews, documents when needed, and reports completion.

**Subagent delegation:** The orchestrator uses `permission.task` in its frontmatter to control which subagents it can invoke. `allow` means automatic delegation; `ask` means the orchestrator must get user approval before delegating.

| Agent | Mode | Purpose |
|-------|------|---------|
| `helm-orchestrator` | primary | Workflow owner — classifies tasks, delegates subagents, verifies completion |
| `helm-build` | subagent | General implementation worker — code edits, builds, lint, typecheck, routine fixes |
| `helm-planner` | subagent | Implementation planning and strategy |
| `helm-backend` | subagent | Python FastAPI implementation |
| `helm-frontend` | subagent | React Native + Web admin implementation |
| `helm-protocol` | subagent | API/WS/MCP contract definitions |
| `helm-agent-runtime` | subagent | PydanticAI + MCP implementation |
| `helm-tester` | subagent | Test writing and execution — can use QA suite/discovery system for drift checks |
| `helm-reviewer` | subagent | Code quality gate, architecture review, feature completeness |
| `helm-ui-reviewer` | subagent | Multimodal UI reviewer — screenshots, layout, visual regressions |
| `helm-docs` | subagent | Documentation maintenance |
| `helm-security` | subagent | Security audit, secrets detection |
| `helm-git` | subagent | Branch management, commit discipline |

The OpenCode config uses `AGENTS.md` (portable instructions), `opencode.jsonc` (project settings), and `.opencode/` (agents, commands).

## Orchestration Principles (Claude Code)

- **Delegate, don't do.** For complex tasks, use sub-agents. Your context window is finite.
- **Series, not parallel.** Invoke one agent at a time.
- **Autonomy over micro-management.** Give agents tasks, not file-level instructions.
- **PARTIAL RESULT continuation.** When a sub-agent returns partial results, re-invoke with remaining items.
- **Memory first, files second.** Check mem0 before reading source.

## Session Context

`docs/codebase-explanation/` holds the living technical documentation. Read the relevant file(s) before any work. The AI-TECHNICAL-REFERENCE.md is the entry point.
