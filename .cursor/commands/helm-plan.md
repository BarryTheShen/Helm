# /helm-plan

> This command is an optional shortcut. The default path is to ask `helm-orchestrator` normally — it will decide whether planning is needed. Use this command when you want a targeted plan.

Plan the implementation strategy for: $ARGUMENTS

## What It Does

1. Read `docs/codebase-explanation/` to identify affected files, patterns, and risks.
2. Map the dependency chain — what modules, routes, schemas, and tests are involved.
3. Produce a step-by-step implementation plan with file-level specificity.
4. Surface trade-offs and edge cases before any code is written.

### Feature Feedback / Product-Spec Mode

When `$ARGUMENTS` involves a Feature Feedback document, product spec, or detailed feature request:

1. **First, invoke `helm-requirements-auditor`** to produce the requirements ledger (`requirements-ledger.md`), audit (`requirements-audit.md`), implementation slices (`implementation-slices.md`), and source index (`source-index.md`).
2. **Wait for APPROVED status** from the auditor. If OBJECTIONS are returned, relay them — do not proceed to planning.
3. **Proceed with standard planning** — but now the plan is ledger-guided and REQ-ID-referenced.
4. **Plan must include:**
   - Included REQ-IDs (which requirements are in scope)
   - Excluded REQ-IDs (which requirements are explicitly out of scope, with reason)
   - Each implementation step referencing specific REQ-IDs (e.g., `Step 1: Implement REQ-FF4-001..003`)

Barry's request like "fix Feature Feedback 4" should trigger the full chain: auditor → planner → critic → implementation — without requiring separate prompts for each step.

## Rules

- Read-only. No code changes, no bash.
- Reference existing patterns in the codebase — don't invent new architectures.
- If the task crosses layers (backend + frontend), flag it for `/helm-api` or `/helm-ui` follow-up.
- Keep plans concise: bullet points, not prose.

## Agent roles in this workflow
- **helm-planner**: Produces the implementation plan. Read-only. No edits, no bash.

This is a planning-only command. No implementation happens here.
