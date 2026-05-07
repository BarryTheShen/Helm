# Helm — Claude Code Instructions

**Read `AGENTS.md` first.** That is the primary source of truth for all AI coding agents.

This file exists for Claude Code compatibility — it adds Claude Code-specific behavior on top of the shared instructions.

---

## Claude Code-Specific Rules

### Persistent Workflow

- **Use sub-agents for everything.** Launch up to 16 sub-agents (depth-1, cannot spawn children). Your context window is finite — delegate.
- **Series, not parallel.** Invoke one sub-agent at a time. Wait for output before invoking the next.
- **Always commit and push** atomic changes to the `modernize/import-libraries` branch after each step.
- **Exhaustive testing:** Use up to 6 parallel live-tester agents for large features. Especially check against `docs/Agentic AI Super App — Project Hub/Feature Feedback 3 34bb13d65bb38028b625e2a2da97056b.md` for known bugs.
- **Debugging:** Write debug scripts and debug hints in code. Never guess — add console.log with clear labels showing WHERE in the process things are.

### Legacy Claude Code Agent Stack (16 Agents)

> These are Claude Code-specific — not portable to other tools. See `docs/ai/agents.md` for the target OpenCode roster.

16 agent definitions live in `.claude/agents/`. Read the relevant agent file for its full prompt.

| Agent | Scope |
|-------|-------|
| `session-init` | haiku — session folder creation/archiving |
| `requirements` | sonnet — maps tasks to affected files via docs |
| `due-diligence` | sonnet — reads source, outputs compressed context |
| `planner` | sonnet — generates implementation plans |
| `plan-critic` | sonnet — challenges plan assumptions |
| `protocol-dev` | sonnet — API/WS/MCP contract definitions |
| `backend-dev` | sonnet — Python FastAPI implementation |
| `frontend-dev` | sonnet — React Native + Web admin |
| `agent-dev` | sonnet — PydanticAI + MCP implementation |
| `tester` | sonnet — pytest-asyncio test writing |
| `live-tester` | sonnet — Playwright functional verification |
| `ui-reviewer` | sonnet — visual quality review |
| `reviewer` | sonnet — code quality gate |
| `feature-validator` | sonnet — blueprint spec feature extraction |
| `feature-critic` | sonnet — product completeness gatekeeper |
| `docs-updater` | sonnet — living documentation maintenance |

### Pipeline (Large Features Only)

The full 16-agent pipeline is available for large features. For smaller tasks, match the workflow to task size — see `docs/ai/workflows.md`.

```
Requirements → Due Diligence → Plan → Plan-Critic (max 3 rounds)
  → Implement → Test → Live-Test (if UI change) → Reviewer → Docs-Updater (if needed)
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
- **Task-size workflows:** Match workflow to task size — see `docs/ai/workflows.md`.
- **Memory system:** Mem0 persistent memory across sessions. Save after tasks, search before tasks.
- **Context7:** Up-to-date library docs via MCP. Use instead of guessing API syntax.
- **Backend port:** 8000 (confirmed in `config.py`). Web Admin: 5174. Agent: 7860.
- **Session 11 (2026-04-30):** App platform — App model, AppModuleRef, ModuleInstance, Settings, Todo, Article, Device models; AppEditorPage, PillEditor, ModulesTree, BrowserPreview in web; AppConfigStore, launchpad screen in mobile.
