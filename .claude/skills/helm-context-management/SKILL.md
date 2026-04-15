---
name: helm-context-management
description: Context isolation and management rules for Helm multi-agent workflow. Defines file read limits, search-before-read patterns, summary-not-files relay protocol, session folder system. Use when orchestrating agents or managing context budgets.
---

# Helm Context Management

Context isolation is the #1 priority in the Helm multi-agent workflow. Each sub-agent must complete its task within a tight context budget.

## Agent Hierarchy (Claude Code — Flat)

All agents are at depth 1. Only the main conversation (CLAUDE.md orchestrator) can invoke sub-agents. Sub-agents cannot spawn other sub-agents.

```
Level 0: Main conversation / CLAUDE.md (orchestrator — invokes sub-agents)
Level 1: ALL sub-agents (leaf nodes, no further spawning)
```

## Session Folder System

All session context lives in `.helm-sessions/current/` (git-ignored, runtime only):

| File | Written By | Read By | Purpose |
|------|-----------|---------|---------|
| `session.md` | session-init, docs-updater | orchestrator | Session metadata, activity log |
| `global-context.md` | due-diligence | All sub-agents | Compressed codebase context |
| `feature-map.md` | requirements | planner, reviewer | Dependency map |
| `current-plan.md` | planner | planner, orchestrator | Active plan with checkboxes |

**Step 0 for all agents:** Check session folder before reading source files.

## Core Rules

### 1. Read ≤5 Files at a Time
No agent should have >5 source files loaded simultaneously. Read in batches.

### 2. Search Before Read
Use `Grep` and `Glob` to find exact locations before `Read`. Never read entire files hoping to find something.

### 3. Summaries, Not Files
When the orchestrator invokes a sub-agent, pass OUTPUT from the previous agent — not raw files. Due-diligence exists to compress context.

### 4. Session Cache First
Before analyzing source files, check if `.helm-sessions/current/global-context.md` already has the context you need.

### 5. PARTIAL RESULT Protocol
If a sub-agent runs out of context:
1. Finish the current unit of work
2. Document completed items and remaining items
3. Return a structured PARTIAL RESULT with a Continuation Prompt
4. The orchestrator MUST re-invoke to cover remaining items

### 6. Context Budget Awareness
Large tasks overflow context. Split by:
- Layer (backend vs frontend)
- File batch (≤4 files per invocation)
- Phase (models first → routers next)
- Feature (one feature per invocation)
