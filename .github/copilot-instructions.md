---
applyTo: "**/*"
description: "Workspace instruction: enforce repository behavior rules for code changes and reviews"
---
# Repository Rules — Helm (Agentic AI Super App)

This repository enforces the following mandatory behavior rules for contributors and AI assistants. Include these rules in your decision-making when proposing edits, fixes, or reviews.

---

## Core Principles

- **Root-cause first:** Find and fix the root cause, not just the symptom. Prefer minimal, surgical changes.
- **One change, one concern:** Keep commits focused and atomic; do not bundle unrelated fixes.
- **Never commit to `main`:** Create an atomic branch, open a PR, and follow code review processes.
- **No secrets in code:** Use environment variables and secure storage; never hardcode API keys or credentials.
- **Safety & clarity:** Ask concise clarifying questions when requirements are ambiguous and state assumptions explicitly.

---

## Workflow: Reproduce → Diagnose → Fix → Verify → Document → Prevent

Follow this cycle for bug fixes and features:

1. **Reproduce:** Produce a failing test or minimal reproduction first.
2. **Diagnose:** Gather evidence. Read relevant source code AND documentation before proposing a fix — see the Documentation Reference section below.
3. **Fix:** Implement an elegant, minimal fix targeting the root cause.
4. **Verify:** Run layer-appropriate verification (see below).
   - If the approach is wrong, revert and try a different method.
   - If it's a small localized mistake, fix it once.
   - Do not stack blind patches.
5. **Document:** Document the root cause and rationale. Add or update short docstrings or docs explaining WHY non-obvious decisions were made.
6. **Prevent:** Add tests or guards to prevent regression.

---

## Layer-Specific Verification

Run the verification that matches what you changed:

| Layer Changed | Required Verification | Conditional |
|---------------|----------------------|-------------|
| Backend code | `cd backend && pytest -q` | Migration check if models changed |
| Web admin UI | `cd web && npm run lint` | `npm run build` for type check; Playwright if UI behavior changed |
| Mobile code | `cd mobile && npx expo start` smoke | Simulator/device check if UI behavior changed |
| MCP tools | Backend tests + MCP smoke test | Integration test if tool behavior changed |
| Agent runtime | Deterministic tool-call/API tests | |
| Docs/config only | Path/link sanity, no secrets | Grep stale references |

---

## Bug Fixing Discipline

Fix the issue thoroughly. After fixing:

1. Run the relevant test suite for the layer changed.
2. Check for obvious regressions in adjacent features.
3. If the fix introduces new issues, assess: wrong approach (revert) or small localized mistake (fix once). Do not stack blind patches.

---

## Documentation Reference

Before proposing any edit, consult the project's internal documentation:

- **`docs/codebase-explanation/`** — Read this for explanations of existing code, architecture decisions, and module responsibilities. Always check here before modifying unfamiliar code.
- **`docs/Agentic AI Super App — Project Hub`** — Go to the **docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents** for system-level architecture and design decisions.
- **`AGENTS.md`** — Primary source of truth for coding agent behavior.
- When in doubt about how something works or why it was built a certain way, **read the docs first, then read the code, then ask.**

---

## Tests First

- When fixing bugs or adding features, **add a failing unit/integration test that reproduces the issue before changing production code.**
- Verify fully: run and describe the commands to run relevant tests locally; include new tests that would catch the issue.

---

## Code Conventions

Follow repository conventions:
- TypeScript strict mode (frontend)
- Python type hints (backend)
- Functional components, named exports
- Small, focused files with meaningful names

---

## Usage Notes

- This instruction is loaded for all files in the repository (`applyTo: "**/*"`).
- If you prefer file-scoped loading, change `applyTo` to a narrower glob (e.g., `backend/**` or `mobile/src/**`).
