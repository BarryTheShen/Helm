---
mode: agent
description: Bug fix workflow — Reproduce → Diagnose → Fix → Verify → Document → Prevent
tools: ['search', 'editFiles', 'runInTerminal', 'terminalLastCommand', 'fetch', 'usages', 'agent']
---

# Bug Fix: ${input:bugDescription}

Follow the Helm bug fix workflow exactly. Use the `helm-dev` orchestrator pattern.

## Step 1: Reproduce

Read [docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md](../docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) to understand the current state. Check the Known Bugs table — this bug may already be documented.

Write a **failing test** in `backend/tests/` that reproduces the bug:
- Find the appropriate test file (or create one if needed)
- Use the `auth_client` fixture for authenticated endpoints
- Assert the CORRECT behavior — the test should FAIL before the fix

Run the test to confirm it fails:
```bash
cd backend && pytest tests/test_file.py::test_name -v
```

## Step 2: Diagnose

Gather evidence:
- Read error messages and stack traces
- Search for the affected code: use `search` and `usages`
- Read ≤5 source files to understand the context
- Identify the ROOT CAUSE — not just the symptom

## Step 3: Fix

Implement a minimal, elegant fix targeting the root cause:
- Change only what needs to change
- Follow existing patterns in the codebase
- Match the code style of surrounding code

## Step 4: Verify

Run the reproduction test — it must now PASS:
```bash
cd backend && pytest tests/test_file.py::test_name -v
```

Run the full test suite — no regressions:
```bash
cd backend && pytest
```

**If the fix doesn't work: REVERT completely.** Don't stack fixes. Go back to Step 2 and re-diagnose.

## Step 5: Document

Update docs if needed:
- Remove from Known Bugs in `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` if it was listed
- Add to patterns if the fix reveals a non-obvious pattern
- Update `CLAUDE.md` "Common Mistakes to Avoid" if applicable

## Step 6: Prevent

The reproduction test from Step 1 is the prevention. Verify it covers the root cause, not just the specific symptom.

## Bug Description

${input:bugDescription}
