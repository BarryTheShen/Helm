---
name: helm-context-management
description: Context isolation and management rules for Helm multi-agent workflow. Defines file read limits, search-before-read patterns, summary-not-files relay protocol, and context compression guidelines. Use when orchestrating between agents or managing context budgets.
---

# Helm Context Management

Context isolation is the #1 priority in the Helm multi-agent workflow. Each sub-agent must complete its task within a tight context budget. These rules prevent context overflow and ensure efficient agent operation.

## Core Rules

### 1. Read ≤5 Files at a Time
No agent should have more than 5 source files loaded simultaneously. If you need more context, read in batches — process the first batch, extract what you need, then read the next.

### 2. Search Before Read
Always use `search` and `usages` tools before `read_file`. Narrow down to the exact files and line ranges you need. Don't read entire files when you only need a function signature.

### 3. Docs First, Source Second
Prefer `docs/codebase-explanation/` over raw source files for orientation. The docs contain pre-digested summaries of file purposes, data flows, and patterns. Only read source when you need implementation details the docs don't cover.

### 4. Summaries Between Agents, Not Files
The orchestrator passes **context summaries** between sub-agents — never raw file contents. When a sub-agent completes its task, it returns a concise output. The orchestrator extracts the relevant parts and passes them to the next agent.

### 5. Due Diligence Is the Compressor
The due-diligence agent is the designated context compressor. It reads the actual source files that will be modified and outputs a "context package" — a 50-line summary of a 2000-line file. This package is what implementers receive, not the raw source.

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

1. Orchestrator receives user task
2. Orchestrator invokes requirements agent with task description
3. Requirements agent returns: affected files, risks, integration points
4. Orchestrator invokes due-diligence with the requirements output
5. Due-diligence reads source files → returns context package (compressed)
6. Orchestrator passes context package (NOT raw files) to implementer
7. Implementer works within the context package + its own file reads (≤5)
8. Orchestrator invokes reviewer with implementation summary
9. Reviewer reads changed files + context package to validate

## Cross-Layer Task Protocol

For tasks that span backend + frontend + protocol:

1. Orchestrator invokes protocol-dev FIRST to define the contract
2. Protocol-dev outputs: API contract diff (endpoints, WS messages, types)
3. Orchestrator passes contract to backend-dev and frontend-dev separately
4. Each implements their side independently, honoring the contract
5. Reviewer validates both sides match the contract
