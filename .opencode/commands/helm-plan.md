---
description: Plan an implementation strategy
agent: helm-planner
---

# /helm-plan

> This command is an optional shortcut. The default path is to ask `helm-orchestrator` normally — it will decide whether planning is needed. Use this command when you want a targeted plan.

Plan the implementation strategy for: $ARGUMENTS

## What It Does

1. Read `docs/codebase-explanation/` to identify affected files, patterns, and risks.
2. Map the dependency chain — what modules, routes, schemas, and tests are involved.
3. Produce a step-by-step implementation plan with file-level specificity.
4. Surface trade-offs and edge cases before any code is written.

## Rules

- Read-only. No code changes, no bash.
- Reference existing patterns in the codebase — don't invent new architectures.
- If the task crosses layers (backend + frontend), flag it for `/helm-api` or `/helm-ui` follow-up.
- Keep plans concise: bullet points, not prose.
