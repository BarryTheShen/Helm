# Agent Definitions

Claude Code uses 16 depth-1 sub-agents for the Helm project. Sub-agents cannot spawn other sub-agents.

> **Note:** OpenCode does not support user-defined sub-agents (4 built-in only: coder, task, title, summarizer). When working in OpenCode, follow the workflows in `docs/ai/workflows.md` manually rather than delegating to sub-agents.

## Agent Roster

| Agent | Model | Scope |
|-------|-------|-------|
| `session-init` | haiku | Session folder creation/archiving |
| `requirements` | sonnet | Maps tasks to affected files via docs |
| `due-diligence` | sonnet | Reads source, outputs compressed context |
| `planner` | sonnet | Generates implementation plans |
| `plan-critic` | sonnet | Challenges plan assumptions against codebase |
| `protocol-dev` | sonnet | API/WS/MCP contract definitions |
| `backend-dev` | sonnet | Python FastAPI implementation |
| `frontend-dev` | sonnet | React Native + Web admin |
| `agent-dev` | sonnet | PydanticAI + MCP implementation |
| `tester` | sonnet | pytest-asyncio test writing |
| `live-tester` | sonnet | Playwright functional verification |
| `ui-reviewer` | sonnet | Visual quality review |
| `reviewer` | sonnet | Code quality gate + feature completeness |
| `feature-validator` | sonnet | Blueprint spec feature extraction |
| `feature-critic` | sonnet | Product completeness gatekeeper |
| `docs-updater` | sonnet | Living documentation maintenance |

## Agent Files

Claude Code agent definitions live in `.claude/agents/` (16 files). Copilot-compatible agents live in `.github/agents/` (18 files). These are tool-specific and not portable.

## Orchestration Principles

- **Delegate, don't do.** For complex tasks, use sub-agents. Your context window is finite.
- **Series, not parallel.** Invoke one agent at a time.
- **Autonomy over micro-management.** Give agents tasks, not file-level instructions.
- **PARTIAL RESULT continuation.** When a sub-agent returns partial results, re-invoke with remaining items.
- **Memory first, files second.** Check mem0 before reading source.

## Session Context

`docs/codebase-explanation/` holds the living technical documentation. Read the relevant file(s) before any work. The AI-TECHNICAL-REFERENCE.md is the entry point.
