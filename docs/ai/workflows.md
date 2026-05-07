# Development Workflow

## Standard Pipeline

```
Requirements → Due Diligence → Plan → Plan-Critic (max 3 rounds)
  → Implement → Test → Live-Test → Feature-Validator → Reviewer
  → Feature-Critic (gatekeeper) → Docs-Updater (always last)
```

### Task-Type Shortcuts

| Task Type | Workflow |
|-----------|----------|
| Backend bug fix | due-diligence → plan → tester (repro) → backend-dev → tester → reviewer → live-test → docs |
| Frontend bug fix | due-diligence → plan → frontend-dev → reviewer → live-test → ui-review → docs |
| New API endpoint | due-diligence → protocol-dev → plan → backend-dev → frontend-dev → tester → reviewer → live-test → docs |
| New MCP tool | due-diligence → protocol-dev → plan → backend-dev + agent-dev → tester → reviewer → docs |
| New SDUI component | due-diligence → protocol-dev (schema) → plan → frontend-dev → reviewer → live-test → ui-review → docs |
| Docs-only change | docs-updater |

## Bug Fix Loop

1. **REPRODUCE** — Write a failing test or minimal reproduction. If you can't reproduce it, try harder.
2. **DIAGNOSE** — Trace execution path. Read error messages. Compare against working cases.
3. **FIX** — Minimal change addressing root cause. No surface-level patches.
4. **VERIFY** — Run reproduction + full suite. No regressions.
5. **DOCUMENT** — Commit message explains WHY.
6. **PREVENT** — Add test to catch this class of bug.

If the fix doesn't work, **revert completely** and try a different approach. Do not stack failed fixes.

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
