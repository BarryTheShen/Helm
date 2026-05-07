# Agent Definitions

## Current: Claude Code Agent Stack (16 Agents)

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
| `feature-validator` | sonnet | Blueprint spec feature extraction |
| `feature-critic` | sonnet | Product completeness gatekeeper |
| `docs-updater` | sonnet | Living documentation maintenance |

Copilot-compatible agent definitions live in `.github/agents/` (18 files). These are tool-specific and not portable.

## Target: Simplified Agent Roster (Future)

When OpenCode config is added, the agent roster should be simplified. Do not blindly copy `fmflurry/settings-opencode` — borrow patterns, adapt to Helm's context.

| Agent | Purpose |
|-------|---------|
| `helm-build` | Build, lint, typecheck across all layers |
| `helm-planner` | Implementation planning and strategy |
| `helm-backend` | Python FastAPI implementation |
| `helm-frontend` | React Native + Web admin implementation |
| `helm-protocol` | API/WS/MCP contract definitions |
| `helm-agent-runtime` | PydanticAI + MCP implementation |
| `helm-tester` | Test writing and execution |
| `helm-reviewer` | Code quality gate, architecture review |
| `helm-docs` | Documentation maintenance |
| `helm-security` | Security audit, secrets detection |
| `helm-git` | Branch management, commit discipline |

Future OpenCode setup should use `AGENTS.md` plus `opencode.jsonc` and `.opencode/` folders, following official OpenCode docs.

## Orchestration Principles (Claude Code)

- **Delegate, don't do.** For complex tasks, use sub-agents. Your context window is finite.
- **Series, not parallel.** Invoke one agent at a time.
- **Autonomy over micro-management.** Give agents tasks, not file-level instructions.
- **PARTIAL RESULT continuation.** When a sub-agent returns partial results, re-invoke with remaining items.
- **Memory first, files second.** Check mem0 before reading source.

## Session Context

`docs/codebase-explanation/` holds the living technical documentation. Read the relevant file(s) before any work. The AI-TECHNICAL-REFERENCE.md is the entry point.
