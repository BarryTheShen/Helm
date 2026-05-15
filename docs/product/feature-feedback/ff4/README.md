# Feature Feedback 4 — Product Spec Snapshot

This directory is the persistent, reusable source-of-truth product spec for Feature Feedback 4.

**Relationship to session artifacts:**
- `.helm-sessions/current/` is the active working copy for the current session.
- `docs/product/feature-feedback/ff4/` is the canonical product spec snapshot.
- Session artifacts (ledger, slices, qa-plan, etc.) may be regenerated from this snapshot at the start of each FF4 session.
- After a session completes, improvements to the product spec should be merged back here.

**Status:** Populated (2026-05-15)

## Summary

| Metric | Value |
|--------|-------|
| Total REQ-IDs | 124 |
| Must-have | 101 |
| Should | 14 |
| Could | 5 |
| Deferred | 4 |
| Implementation Slices | 10 |
| Source Documents | 5+ |

## Files

- `source-index.md` — Maps each source document section to the REQ-IDs it generates (32 entries)
- `requirements-ledger.md` — Atomic requirements table with full traceability (124 REQ-IDs)
- `requirements-audit.md` — Completeness audit findings (12 items)
- `implementation-slices.md` — 10 domain-cohesive implementation groupings with dependency ordering
- `qa-plan.md` — QA coverage classification per REQ-ID
- `traceability.md` — Cross-reference: REQ-ID → source → implementation → test → verdict
- `slices/` — 10 per-slice claim files following the standard 16-field slice schema (all unclaimed)

## Slice Summary

| Slice | REQ-IDs | Order | Dependencies |
|-------|---------|-------|-------------|
| FF4-SLICE-BACKEND | 18 | 1 | none |
| FF4-SLICE-ROWS-CELLS-LAYOUT | 19 | 2 | BACKEND |
| FF4-SLICE-VERSIONING | 9 | 3 | BACKEND |
| FF4-SLICE-MODULE-EDITOR | 16 | 4 | BACKEND, ROWS-CELLS, VERSIONING |
| FF4-SLICE-APP-EDITOR | 27 | 5 | BACKEND, MODULE-EDITOR, VERSIONING |
| FF4-SLICE-COMPONENTS | 27 | 6 | BACKEND, ROWS-CELLS |
| FF4-SLICE-CALENDAR | 25 | 7 | BACKEND, COMPONENTS |
| FF4-SLICE-TEMPLATES | 6 | 8 | BACKEND, COMPONENTS, VERSIONING |
| FF4-SLICE-WORKFLOWS | 2 | 9 | BACKEND |
| FF4-SLICE-MCP-QA | 11 | 10 | BACKEND |
