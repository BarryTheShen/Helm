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

Follow this exact cycle for every bug fix or feature:

1. **Reproduce:** Produce a failing test or minimal reproduction first. Always use the **Playwright to live test** — do NOT use simulations or mocked browser behavior, because simulations frequently produce false passes.
2. **Diagnose:** Gather evidence. Read relevant source code AND documentation before proposing a fix — see the Documentation Reference section below.
3. **Fix:** Implement an elegant, minimal fix targeting the root cause.
4. **Verify:** Live test again with Playwright. Run all relevant unit/integration tests.
   - **If verification still fails:** Immediately **revert your change**, reassess the situation, and try a different approach. Do not keep patching a failing path — backtrack and find a better method.
5. **Document:** Document the root cause and rationale. Add or update short docstrings or docs explaining WHY non-obvious decisions were made.
6. **Prevent:** Add tests or guards to prevent regression.

---

## Exhaustive Bug Fixing

Do NOT stop after fixing one bug. Follow this loop:

1. Fix the current bug using the workflow above.
2. After fixing, run a **full test suite** (live test with Playwright + unit/integration tests).
3. Identify any additional bugs or regressions.
4. Fix them — repeat from step 1.
5. Continue until there are **zero bugs** you can find. Only then move on.

The goal is a clean, fully working state — not a partial fix.

---

## Live Testing (Mandatory)

- **Always use Playwright for live testing.** This is non-negotiable.
- Do not rely on simulated environments, mocked browsers, or headless assumptions. Real browser testing catches issues that simulations miss.
- After every change, open the app in Playwright, verify the fix visually and functionally, and confirm no regressions.

---

## Sub-Agents

- **Spawn sub-agents to improve efficiency** when tasks can be parallelized (e.g., one agent fixes a backend bug while another fixes a frontend bug, or one agent writes tests while another implements the fix).
- Coordinate sub-agent work to avoid conflicting changes.

---

## Documentation Reference

Before proposing any edit, consult the project's internal documentation:

- **`docs/code-explanation/`** — Read this for explanations of existing code, architecture decisions, and module responsibilities. Always check here before modifying unfamiliar code.
- **`docs/Agentic AI Super App — Project Hub`** — Go to the **docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents** and **docs/Agentic AI Super App — Project Hub/Architecture Decisions — Session 2 (2026-03-29) 8c271ee63ff84db797d10a11214bfd47.md** for system-level architecture, design decisions, and component relationships. This is the source of truth for high-level design.
- When in doubt about how something works or why it was built a certain way, **read the docs first, then read the code, then ask.**

---

## Tests First

- When fixing bugs or adding features, **add a failing unit/integration test that reproduces the issue before changing production code.**
- Verify fully: run and describe the commands to run relevant tests locally and in CI; include new tests that would catch the issue.

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