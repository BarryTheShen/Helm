---
name: helm-context-management
description: Context isolation and management rules for Helm multi-agent workflow. Defines file read limits, search-before-read patterns, summary-not-files relay protocol, session folder system, and nesting depth limits. Use when orchestrating between agents or managing context budgets.
---

# Helm Context Management

Context isolation is the #1 priority in the Helm multi-agent workflow. Each sub-agent must complete its task within a tight context budget. These rules prevent context overflow and ensure efficient agent operation.

## Agent Nesting Depth Limits (CRITICAL)

The allowed nesting hierarchy is exactly **3 levels deep**:

```
Level 0: helm-dev (orchestrator) — invokes sub-agents
Level 1: All direct sub-agents (requirements, due-diligence, planner, reviewer, etc.)
          ONLY planner may spawn plan-critic
          ONLY reviewer may spawn feature-validator
Level 2: plan-critic, feature-validator — ABSOLUTE LEAF NODES, no further spawning
Level 3+: FORBIDDEN — causes cancellation of the entire workflow
```

**The recursion trap**: An agent at level 1 sees a task, thinks "I should delegate this," invokes
a level-2 agent, which also delegates to a level-3, which delegates to level-4, and so on until
the context is cancelled. **All sub-agents must carry a DEPTH RULE block forbidding this.**

## Session Folder System

All session context lives in `.helm-sessions/current/` (git-ignored, runtime only):

| File | Written By | Read By | Purpose |
|------|-----------|---------|---------|
| `session.md` | session-init, docs-updater | helm-dev | Session metadata, activity log |
| `global-context.md` | due-diligence | All sub-agents | Compressed codebase context |
| `feature-map.md` | requirements | planner, reviewer | Dependency map for features |
| `current-plan.md` | planner | planner, helm-dev | Active implementation plan (with checkboxes) |

**Session folder check is STEP 0 for context-gathering agents.** Before reading source files,
check if relevant context already exists in the session folder.

### Session Lifecycle

1. **New session**: helm-dev invokes `session-init` → creates folder + `session.md`
2. **During session**: agents read/write session files for shared context
3. **End of session**: helm-dev invokes `session-init --fresh` → archives to `.helm-sessions/archive/TIMESTAMP/`

## Core Rules

### 1. Read ≤5 Files at a Time
No agent should have more than 5 source files loaded simultaneously. If you need more context, read in batches — process the first batch, extract what you need, then read the next.

### 2. Search Before Read
Always use `search` and `usages` tools before `read_file`. Narrow down to the exact files and line ranges you need. Don't read entire files when you only need a function signature.

### 3. Session Cache Before Source
Before reading source files, check `.helm-sessions/current/global-context.md`. If it covers what you need, use it and skip reading source files. Only read source when the session cache doesn't have the specific context.

### 4. Summaries Between Agents, Not Files
The orchestrator passes **context summaries** between sub-agents — never raw file contents. When a sub-agent completes its task, it returns a concise output. The orchestrator extracts the relevant parts and passes them to the next agent.

### 5. Due Diligence Is the Compressor + Cache Writer
The due-diligence agent reads source files and writes the compressed "context package" to `.helm-sessions/current/global-context.md`. Implementers read from there, not raw source files.

## Context Package Format

When due-diligence outputs a context package, it follows this structure:

```markdown
## Context Package: [Task Name]

### Files to Modify
- `path/to/file.py` — [what this file does, 1 line]

### Patterns to Follow
- [Existing pattern in the codebase that the implementer must match]

### Pitfalls
- [Specific things that will break if done wrong]

### Integration Points
- [Other files/systems that connect to the modified files]

### Key Code Snippets
[Only the specific functions/classes the implementer needs to see — not full files]
```

## Orchestrator Relay Protocol

1. Orchestrator invokes `session-init` (new session) or reads `session.md` (resuming)
2. Orchestrator invokes `requirements` → returns affected files, risks, integration points
3. Orchestrator invokes `due-diligence` → reads source, writes to `global-context.md`, returns context package
4. Orchestrator passes context package summary (NOT raw files) to implementer
5. Implementer reads session cache + does own targeted searches (≤5 files)
6. Orchestrator invokes `reviewer` → reviewer runs feature-validator + code quality checks
7. Orchestrator invokes `docs-updater` → runs git diff, updates all docs autonomously

## Cross-Layer Task Protocol

For tasks that span backend + frontend + protocol:

1. Orchestrator invokes protocol-dev FIRST to define the contract
2. Protocol-dev outputs: API contract diff (endpoints, WS messages, types)
3. Orchestrator passes contract to backend-dev and frontend-dev separately
4. Each implements their side independently, honoring the contract
5. Reviewer validates both sides match the contract
