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

| Agent | Type | Can edit? | Can run tests? | Can commit/push? | Main responsibility | Explicitly does NOT do |
|-------|------|-----------|----------------|------------------|--------------------|-----------------------|
| `helm-orchestrator` | primary | No | No | No | Classify tasks, delegate subagents, verify completion, report | Read source, write code, fix bugs, review code, run tests |
| `helm-build` | subagent | Yes (backend, frontend, mobile, config) | Yes | No | General implementation worker, routine fixes | Commit, edit docs/agent-prompts, blindly apply specialist suggestions |
| `helm-planner` | subagent | No | No | No | Read-oriented implementation planning | Edit files, run commands, implement anything |
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

### Handoff Model

Specialist agents (tester, reviewer, security, ui-reviewer) are **advisory by default**. They produce findings, not fixes.

**Standard handoff flow:**
1. Specialist identifies issue → reports finding with file path, line number, diagnosis
2. Orchestrator reads the finding → decides if a fix is needed
3. Orchestrator delegates fix to the appropriate implementation agent (build, backend, frontend, agent-runtime)
4. Implementation agent applies the fix
5. Tester verifies the fix (if behavior changed)
6. Reviewer checks quality (if the change is risky)

**Key rules:**
- Tester does NOT fix application code by default
- Reviewer does NOT fix by default
- Security does NOT fix by default
- Git does NOT modify app code
- Only implementation agents (build, backend, frontend, agent-runtime) edit application source

The OpenCode config uses `AGENTS.md` (portable instructions), `opencode.jsonc` (project settings), and `.opencode/` (agents, commands).

## Orchestration Principles (Claude Code)

- **Delegate, don't do.** For complex tasks, use sub-agents. Your context window is finite.
- **Series, not parallel.** Invoke one agent at a time.
- **Autonomy over micro-management.** Give agents tasks, not file-level instructions.
- **PARTIAL RESULT continuation.** When a sub-agent returns partial results, re-invoke with remaining items.
- **Memory first, files second.** Check mem0 before reading source.

## Session Context

`docs/codebase-explanation/` holds the living technical documentation. Read the relevant file(s) before any work. The AI-TECHNICAL-REFERENCE.md is the entry point.
