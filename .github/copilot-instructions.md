---
applyTo: "**/*"
description: "Workspace instruction: enforce repository behavior rules for code changes and reviews"
---

This repository enforces the following mandatory behavior rules for contributors and AI assistants. Include these rules in your decision-making when proposing edits, fixes, or reviews.

- Root-cause first: find and fix the root cause, not just the symptom. Prefer minimal, surgical changes.
- Reproduce → Diagnose → Fix → Verify → Document → Prevent: always produce a failing test or minimal reproduction first, gather evidence, implement an elegant fix, verify with tests, document the root cause and rationale, and add tests or guards to prevent regression.
- Tests first: when fixing bugs or adding features, add a failing unit/integration test that reproduces the issue before changing production code.
- One change, one concern: keep commits focused and atomic; do not bundle unrelated fixes.
- Never commit to `main`: create an atomic branch, open a PR, and follow code review processes.
- Code conventions: follow repository conventions (TypeScript strict mode frontend, Python type hints, functional components, named exports, small focused files, meaningful names).
- No secrets in code: use environment variables and secure storage; never hardcode API keys or credentials.
- Verify fully: run and describe the commands to run relevant tests locally and in CI; include new tests that would catch the issue.
- Documentation: add or update short docstrings or docs explaining WHY non-obvious decisions were made.
- Safety & clarity: ask concise clarifying questions when requirements are ambiguous and state assumptions explicitly.

Usage notes:

- This instruction is loaded for all files in the repository. Use `applyTo: "**/*"` only when you want repository-wide guidance.
- If you prefer file-scoped loading, change `applyTo` to a narrower glob (for example, `backend/**` or `mobile/src/**`).

If you want, I can open a PR with this file or narrow the `applyTo` pattern.
