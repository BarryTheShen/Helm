# Development Workflow

Choose the workflow that matches the task size. There is no single "standard pipeline" — the workflow scales with the task.

## Task-Size Workflows

### Small Edit (docs, config, single-file fix)

1. Understand the change needed.
2. Make the edit.
3. Run the relevant check for the layer touched (see `docs/ai/verification.md`).
4. Self-review: does it address the issue? Any obvious regressions?

### Bug Fix

1. **Reproduce** — Write a failing test or minimal reproduction.
2. **Diagnose** — Trace execution path. Read error messages. Compare against working cases.
3. **Fix** — Minimal change addressing root cause. No surface-level patches.
4. **Verify** — Run reproduction + relevant test suite.
5. **Document** — Commit message explains WHY.
6. **Prevent** — Add a regression test if useful.

If the approach is wrong, revert and try differently. If it's a small localized mistake, fix it once. Do not stack blind patches.

### Medium Feature (new endpoint, component, page)

1. **Plan** — Brief plan of affected files and changes.
2. **Implement** — Build the feature.
3. **Test** — Relevant tests for the layer changed.
4. **Review** — Self-check against code review checklist below.
5. **Docs** — Update docs if behavior, API, or architecture changes.

### Large Feature (cross-layer, multiple modules)

1. **Research** — Read relevant docs, understand existing patterns.
2. **Plan** — Detailed plan with affected files, dependency order.
3. **Plan Critic** — Challenge assumptions against the actual codebase.
4. **Implement** — Build in dependency order.
5. **Test** — Full test suite for all layers touched.
6. **Review** — Code quality gate, feature completeness check.
7. **Docs** — Update architecture docs, API contracts, living docs.

## Legacy: Full Claude Code Mega-Loop

The original 16-agent pipeline (Requirements → Due Diligence → Plan → Plan-Critic → Implement → Tester → Live-Test → Feature-Validator → Reviewer → Feature-Critic → Docs-Updater) is **available for Claude Code** but is reserved for large features where full quality assurance is needed. It is not the default.

## Code Review Self-Check

- [ ] Does this address the root cause, not a symptom?
- [ ] Could this break downstream dependencies?
- [ ] Are there tests covering the change?
- [ ] Is the code readable without comments?
- [ ] Any duplicated logic to extract?
- [ ] Are error cases handled?
- [ ] Does it follow existing patterns?

## Commit Discipline

- Atomic commits — one logical change per commit
- Imperative mood: `"Add calendar endpoint"` not `"Added calendar endpoint"`
- Run `cd backend && pytest -q` before committing backend changes
- Run `cd web && npm run lint` before committing web changes
- Never commit failing tests or broken builds
- Never commit to `main` directly

## Documentation Updates

Update docs when behavior, API contracts, architecture, or commands change. Not every commit needs a docs update — only when something reader-facing has changed.
