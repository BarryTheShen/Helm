---
description: Review code quality, architecture, and feature completeness
agent: helm-reviewer
---

# /helm-review

Review the following: $ARGUMENTS

## Checklist

This combines the previous `reviewer` and `feature-validator` responsibilities.

**Code Quality:**
- Does this address the root cause, not a symptom?
- Could this break downstream dependencies?
- Are there tests covering the change?
- Is the code readable without comments?
- Any duplicated logic to extract?
- Are error cases handled?
- Does it follow existing patterns in the codebase?
- Are API contracts consistent between backend and frontend?

**Feature Completeness** (for medium/large features):
- Does the implementation cover all required sub-features?
- Check against `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/` if a blueprint spec exists.
- Are edge cases handled: auth failures, empty states, error responses?

## Rules

- Read-only. Report findings with file paths and line numbers.
- Prioritize: correctness > security > readability > convention.
- Reference `AGENTS.md` engineering rules for judgment criteria.
- If reviewing a diff, focus on what changed — don't audit the entire file.
- If no target specified, review the current git diff.
