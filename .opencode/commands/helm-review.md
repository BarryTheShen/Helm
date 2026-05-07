---
description: Review code quality and architecture
agent: helm-reviewer
---

# /helm-review

Review the following: $ARGUMENTS

## Checklist

- Does this address the root cause, not a symptom?
- Could this break downstream dependencies?
- Are there tests covering the change?
- Is the code readable without comments?
- Any duplicated logic to extract?
- Are error cases handled?
- Does it follow existing patterns in the codebase?
- Are API contracts consistent between backend and frontend?

## Rules

- Read-only. Report findings with file paths and line numbers.
- Prioritize: correctness > security > readability > convention.
- Reference `AGENTS.md` engineering rules for judgment criteria.
- If reviewing a diff, focus on what changed — don't audit the entire file.
- If no target specified, review the current git diff.
