---
name: session-handoff
description: Exports current session state for handoff to a new session. Creates a handoff document capturing completed work, remaining tasks, decisions made, and uncommitted changes. Use when context is running low or ending a session.
---

# Session Handoff

Create a handoff document that lets a new session pick up where this one left off.

## Process

### 1. Gather Current State

```bash
# Uncommitted changes
git status --short

# Current branch
git branch --show-current

# Recent commits
git --no-pager log --oneline -10
```

### 2. Read Session Context

Review `.helm-sessions/current/` files for task state and decisions.

### 3. Generate Handoff Document

Create `docs/session-handoff.md`:

```markdown
# Session Handoff — [Date]

## Session Summary
[1-3 sentences: goal of this session]

## Completed
- [Task 1 — what was done]

## In Progress
- [Task — current state, what remains]

## Not Started
- [Task — planned but not begun]

## Key Decisions
- [Decision — what was decided and WHY]

## Files Modified (Uncommitted)
[git status output]

## Known Issues Discovered
- [Issue — file, description, impact]

## What the Next Session Needs to Know
- [Non-obvious state info]
- [Traps or gotchas]
- [Dependencies between remaining tasks]

## Recommended Next Steps
1. [First action]
2. [Second action]
```

### 4. Verify Docs Are Current

Check that `docs/codebase-explanation/` reflects all changes. Stale docs waste future sessions.

### 5. Inform User

> Session handoff created at `docs/session-handoff.md`. Next session: read this file and `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` to pick up where we left off.
