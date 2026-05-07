# Helm — Claude Code Instructions

**Read `AGENTS.md` first.** That is the primary source of truth for all AI coding agents.

This file exists for Claude Code compatibility — it adds Claude Code-specific behavior on top of the shared instructions.

---

## Claude Code-Specific Rules

### Persistent Workflow

- **Use sub-agents for everything.** Launch up to 16 sub-agents (depth-1, cannot spawn children). Your context window is finite — delegate.
- **Series, not parallel.** Invoke one sub-agent at a time. Wait for output before invoking the next.
- **Always commit and push** atomic changes to the `modernize/import-libraries` branch after each step.
- **Exhaustive testing:** Use up to 6 parallel live-tester agents. Especially check against `docs/Agentic AI Super App — Project Hub/Feature Feedback 3 34bb13d65bb38028b625e2a2da97056b.md` for known bugs.
- **Debugging:** Write debug scripts and debug hints in code. Never guess — add console.log with clear labels showing WHERE in the process things are.

### Agent Definitions

16 agent definitions live in `.claude/agents/`. Read the relevant agent file for its full prompt.

| Agent | Scope |
|-------|-------|
| `session-init` | Session folder creation/archiving |
| `requirements` | Maps tasks to affected files via docs |
| `due-diligence` | Reads source, outputs compressed context |
| `planner` | Generates implementation plans |
| `plan-critic` | Challenges plan assumptions |
| `protocol-dev` | API/WS/MCP contract definitions |
| `backend-dev` | Python FastAPI implementation |
| `frontend-dev` | React Native + Web admin |
| `agent-dev` | PydanticAI + MCP implementation |
| `tester` | pytest-asyncio test writing |
| `live-tester` | Playwright functional verification |
| `ui-reviewer` | Visual quality review |
| `reviewer` | Code quality gate |
| `feature-validator` | Blueprint spec feature extraction |
| `feature-critic` | Product completeness gatekeeper |
| `docs-updater` | Living documentation maintenance |

### Standard Pipeline

```
Requirements → Due Diligence → Plan → Plan-Critic (max 3 rounds)
  → Implement → Test → Live-Test → Feature-Validator → Reviewer
  → Feature-Critic (gatekeeper) → Docs-Updater (always last)
```

### Invoking Sub-Agents

When invoking a sub-agent, always include:
- "You CANNOT spawn sub-agents. Do the work yourself."
- "Check `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` for codebase context."
- The task description + relevant context from previous agents (summaries, not raw files).

### Context Management

1. Memory first, files second. Check mem0 before reading source.
2. Summaries, not files. Pass sub-agent output, not raw file contents.
3. Context budget: each sub-agent reads ≤5 files.
4. Always start with `requirements` reading `docs/codebase-explanation/`.
5. MCP sync: when MCP tools change, invoke BOTH `backend-dev` and `agent-dev`.
6. PARTIAL RESULT: when a sub-agent returns partial results, re-invoke with remaining items.
7. Question relay: when a sub-agent returns questions, present to user. Never fabricate answers.

### Session Context

`.helm-sessions/current/` holds runtime context (global-context.md, current-plan.md). Git-ignored. `due-diligence` writes to it; all agents read from it before exploring source.

---

## Codebase Entry Point

Read these before any work:

| File | Read When |
|------|-----------|
| [AGENTS.md](AGENTS.md) | **Always — first.** Project summary, commands, rules, verification. |
| [docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | File map, data flow, patterns |
| [docs/codebase-explanation/OPERATIONS.md](docs/codebase-explanation/OPERATIONS.md) | Running services, ports, env vars |
| [docs/ai/](docs/ai/README.md) | Detailed workflow, project map, agent definitions |

---

## Known Patterns

- **Flat agent hierarchy:** All 16 sub-agents are depth-1. Sub-agents cannot spawn other sub-agents.
- **Completion loop:** Nothing is done until feature-critic approves. Max 5 iterations.
- **Memory system:** Mem0 persistent memory across sessions. Save after tasks, search before tasks.
- **Context7:** Up-to-date library docs via MCP. Use instead of guessing API syntax.
- **Backend port:** 8000 (confirmed in `config.py`). Web Admin: 5174. Agent: 7860.
- **Session 11 (2026-04-30):** App platform — App model, AppModuleRef, ModuleInstance, Settings, Todo, Article, Device models; AppEditorPage, PillEditor, ModulesTree, BrowserPreview in web; AppConfigStore, launchpad screen in mobile.
