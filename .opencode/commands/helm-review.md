---
description: Review code quality, architecture, and feature completeness
agent: helm-reviewer
---

# /helm-review

> This command is an optional shortcut. The default path is to ask `helm-orchestrator` normally — it will invoke the reviewer when changes warrant it. Use this command when you want a targeted review.

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
- Are React hook rules followed? Stale closures? Missing deps? (Review React Doctor output if available)

**Feature Completeness** (for medium/large features):
- Load `.helm-sessions/current/requirements-checklist.md`
- Compare implementation against each requirement
- Classify each: PASS / FAIL / PARTIAL / NOT TESTED
- Check against:
  - User request
  - Latest relevant Feature Feedback docs (if included in task context)
  - Blueprint specs
  - AGENTS.md / workflow constraints
- React Doctor output (if available) is supporting evidence, not the whole review
- Tests passing is not enough if product requirements are missing

**QA Evidence** (optional — for medium/large reviews):
- Review `qa/src/discovered.json` for endpoint, route, action, or component drift.
- Check `qa/results/` for recent test run results.
- Use QA discovery output as evidence, not as a pass/fail gate.

### Feature Feedback / Product-Spec Mode

When `$ARGUMENTS` involves a Feature Feedback document, product spec, or requirements-driven feature:

- **Require `product-completeness-matrix.md`** — the review must read and verify `.helm-sessions/current/product-completeness-matrix.md` (produced by `helm-reviewer`). Each REQ-ID must have a verdict (PASS/FAIL/PARTIAL/NOT TESTED).
- **Require `coverage-gate.md`** — the review must read and verify `.helm-sessions/current/coverage-gate.md`. The gate must be OPEN (all must-have requirements PASS) for the work to proceed.
- **Source context verification** — compare the implementation against the original source context in `requirements-ledger.md` ("Source document/page" and "Context notes" columns), not just against the plan. If the plan lost nuance from the source document, that is a review finding.
- **Overrides above** — For FF/product-spec work, the product completeness review (matrix + gate) takes priority over the standard checklist below.

## Blind Review Rule

Every review is a fresh independent first review. The reviewer MUST ignore any pass-count, attempt-count, or status narrative ("final review", "third pass", "confirm all issues resolved", "should be fixed now", "mostly done", "just verify", "previous reviewer approved") from the handoff context. Base judgment only on the code, requirements, and verification evidence. Assume nothing is fixed until independently verified.

## Rules

- All agents in this workflow are READ-ONLY. No automatic fixes.
- Read-only. Report findings with file paths and line numbers.
- Prioritize: correctness > security > readability > convention.
- Reference `AGENTS.md` engineering rules for judgment criteria.
- If reviewing a diff, focus on what changed — don't audit the entire file.
- If no target specified, review the current git diff.

## Agent roles in this workflow
- **helm-reviewer**: Code quality and architecture review. Read-only. Returns findings grouped by severity. Uses `.helm-sessions/current/requirements-checklist.md` for feature-completeness comparison when available.
- **helm-security** (optional): Security audit. Read-only. Returns security findings.
- **helm-tester** (optional): Run tests to verify current state. Returns test results.
- **helm-ui-reviewer** (automatic if UI changed): Visual review, layout consistency, exhaustive page sweep. Read-only.

All findings are ADVISORY. The orchestrator or primary agent decides what to fix, then delegates fixes to the appropriate implementation agent.
