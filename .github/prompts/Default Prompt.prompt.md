---
name: Default Prompt
description: Describe when to use this prompt
---

---
name: Default Prompt
description: Project-focused assistant prompt emphasizing behavior rules and conventions for code changes, fixes, and reviews.
---

Use this prompt when you are: proposing or making code changes, writing tests, fixing bugs, creating or updating docs, or performing code review for this repository.

Behavior rules (must-follow):

- Root-cause first: Always find and fix the root cause, not just symptoms. Prefer minimal, surgical changes.
- Reproduce → Diagnose → Fix → Verify → Document → Prevent: write a failing test or minimal repro first, diagnose with evidence, implement an elegant fix, verify via the test suite, document the root cause and reasoning, and add tests or guards to prevent regressions.
- Tests first: When fixing bugs or adding features, add a failing unit/integration test that reproduces the issue before changing production code.
- Commit and PR rules: Never commit directly to main. Create an atomic branch and open a PR. Commit messages should be imperative and descriptive.
- Code conventions: Follow repository conventions: TypeScript strict mode for frontend, Python type hints, functional components, named exports, small focused files, meaningful names.
- No secrets: Never add hardcoded secrets, API keys, or environment-specific credentials in code — use environment variables and config.
- One change, one concern: Each change should address a single logical issue. Avoid bundling unrelated fixes.
- Verify fully: Run relevant tests locally (or describe commands to run) and include new tests that would catch the issue in CI.
- Documentation: Update relevant docs or add a short docstring/header explaining the WHY for new modules or non-obvious changes.
- Safety & clarity: Ask concise clarifying questions when requirements are ambiguous. Be explicit about assumptions.

Required developer workflow notes:

- When editing files in this repo, prefer small, focused diffs and include tests. Use the project's test commands (e.g., `cd backend && pytest`, or `npx expo start` for frontend dev checks).
- Follow the project's Code Review Checklist: ensure tests, readability, non-breaking changes, and alignment with existing patterns.
- When automating changes (scripts/patches), provide clear instructions so reviewers can reproduce locally.

Short docs / explanation summary (useful references):

- CLAUDE.md: The canonical project handbook — contains architecture overview, coding conventions, non-negotiable code quality rules (root-cause policy), the mandatory bug-handling loop, testing guidance, and important operational rules (branching, commits, secrets). This file is the primary source of behavioral and process rules for contributors.
- docs/CODEBASE_MAP.md: High-level codebase map and quick reference — shows directory structure, backend entry points, routers, models, frontend routing, SDUI renderer, services, and common commands. Extremely useful for locating files, understanding where to implement features, and finding the right test or router to change.

How to use this prompt:

- Preface tasks with the intended outcome (fix, feature, refactor). State assumptions and the environment (branch, local commands you will run).
- For bug fixes: include a failing test, run it, implement the fix, run full test suite, and add/change documentation.
- For feature work: include design notes, required tests, and small incremental commits.

Keep responses concise, action-oriented, and follow the repository's conventions strictly.

<!-- End of Default Prompt -->