---
mode: agent
description: Export current session state for handoff to a new session — survives context compaction gracefully
tools: ['search', 'editFiles', 'fetch']
---

# Session Handoff

Export the current session state so a new session can pick up where this one left off. This is how we survive context compaction.

## What This Does

Creates a handoff document that captures:
1. What task(s) were in progress
2. What has been completed
3. What remains to be done
4. Key decisions made and WHY
5. Files that were modified
6. Any bugs or issues discovered
7. Current state of the codebase (any uncommitted changes)

## Process

### 1. Gather Current State

Check for uncommitted changes:
```bash
cd "${workspaceFolder}" && git status --short
```

Check current branch:
```bash
cd "${workspaceFolder}" && git branch --show-current
```

Check recent commits on this branch:
```bash
cd "${workspaceFolder}" && git --no-pager log --oneline -10
```

### 2. Read Current Session Context

Review what's been discussed and decided in this session. Search for any temporary notes or TODOs.

### 3. Generate Handoff Document

Create `docs/session-handoff.md` with:

```markdown
# Session Handoff — [Date]

## Session Summary
[1-3 sentences: what was the goal of this session]

## Completed
- [Task 1 — what was done]
- [Task 2 — what was done]

## In Progress
- [Task — current state, what's been started, what remains]

## Not Started
- [Task — planned but not begun]

## Key Decisions
- [Decision 1 — what was decided and WHY]
- [Decision 2 — rationale]

## Files Modified (Uncommitted)
[Output of git status]

## Known Issues Discovered
- [Issue 1 — file, description, impact]

## What the Next Session Needs to Know
- [Anything non-obvious about the current state]
- [Traps or gotchas discovered]
- [Dependencies between remaining tasks]

## Recommended Next Steps
1. [First thing to do in the new session]
2. [Second thing]
3. [Third thing]
```

### 4. Verify Living Docs Are Current

Before ending the session, check that `docs/codebase-explanation/` reflects all changes made. If not, update them — stale docs are the #1 cause of wasted time in subsequent sessions.

### 5. Remind the User

Tell the user:
> Session handoff created at `docs/session-handoff.md`. In your next session, start by reading this file and `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` to pick up where we left off.
