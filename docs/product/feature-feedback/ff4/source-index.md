# Source Index

Maps each source document (page, section) to the requirement IDs it generates.

**Status:** Populated

| Source Document | Source Path | Section/Page | Generated REQ-IDs | Notes |
|----------------|-------------|-------------|-------------------|-------|
| Feature Feedback 4 | `docs/Agentic AI Super App — Project Hub/Feature Feedback 4 356b13d65bb38023ad84cafd611903e3.md` | Helm Admin / App Editor (lines 5-16) | FF4-APP-001, FF4-APP-002, FF4-APP-003, FF4-APP-004, FF4-APP-027, FF4-APP-013 | App Editor UI issues, sync, mobile simplification, dark mode, icons |
| Feature Feedback 4 | same | Visual Editor / General (lines 17-31) | FF4-MOD-001, FF4-MOD-002, FF4-MOD-003, FF4-MOD-004, FF4-MOD-005, FF4-MOD-006, FF4-MOD-007 | Renaming, sidebar, top bar, save button, preview, right-click, templates |
| Feature Feedback 4 | same | Visual Editor / Rows (lines 33-192) | FF4-ROW-001 through FF4-ROW-015 | Drag handles, resize lag, cell width calculation, minimum width, action blocking, pre-flight validation, horizontal scrolling, all-fixed/mixed rules, validation timing, fit-everything, remove padding/gap/background, drag limits |
| Feature Feedback 4 | same | Visual Editor / Cells (lines 194-198) | FF4-CELL-001, FF4-CELL-002, FF4-CELL-003 | Cell resize behavior, delete button overlap, more than 6 cells |
| Feature Feedback 4 | same | Visual Editor / Variable system (lines 200-202) | FF4-VAR-001, FF4-VAR-002 | Hit box, display, QA |
| Feature Feedback 4 | same | Visual Editor / Text (lines 204-208) | FF4-TEXT-001 | Remove text, merge with markdown |
| Feature Feedback 4 | same | Visual Editor / Markdowns (lines 210-214) | FF4-TEXT-002, FF4-TEXT-003, FF4-TEXT-004, FF4-TEXT-005 | Enter key bug, alignment, template migration, variable compatibility |
| Feature Feedback 4 | same | Visual Editor / Buttons (lines 216-218) | FF4-BTN-001, FF4-BTN-002, FF4-BTN-003 | Fit cell, icon mode, template-first |
| Feature Feedback 4 | same | Visual Editor / Image (lines 220-222) | FF4-IMG-001, FF4-IMG-002 | Fit mode, simplified props |
| Feature Feedback 4 | same | Visual Editor / Text input (line 224-226) | (see FF4-TEXT-001 — TextInput removed) | Replaced by InputBar |
| Feature Feedback 4 | same | Visual Editor / Icons (lines 228-230) | FF4-ICON-001 | Icon picker, fit cell |
| Feature Feedback 4 | same | Visual Editor / Empty container (lines 232-248) | FF4-EC-001, FF4-EC-002, FF4-EC-003, FF4-EC-004 | Vertical row design, no separate system, remove styling, Daily Planner test case |
| Feature Feedback 4 | same | Visual Editor / Calendar (lines 250-504) | FF4-CAL-001 through FF4-CAL-021 | Full calendar spec: variants, navigation, fit cell, event model, local-first, sources, color, filtering, data binding, libraries, inspector, templates, acceptance criteria |
| Feature Feedback 4 | same | Visual Editor / Chat (line 507-509) | FF4-DES-002 | Chat deferred |
| Feature Feedback 4 | same | Visual Editor / Notes (lines 511-546) | FF4-NOTES-001 through FF4-NOTES-004 | Notes component, data model, template usage, V1 priority |
| Feature Feedback 4 | same | Visual Editor / Input bar (lines 548-550) | FF4-IB-001 | Send action to backend |
| Feature Feedback 4 | same | Visual Editor / Todo, Article Card, Rich Text (lines 552-554) | FF4-TODO-001, FF4-TODO-002 | Make functional, no custom components |
| Feature Feedback 4 | same | Templates (lines 556-563) | FF4-TPL-001, FF4-TPL-002, FF4-TPL-003 | Template rework, non-existent components, two-step process |
| Feature Feedback 4 | same | Workflows (lines 566-568) | FF4-WF-001, FF4-WF-002 | Test workflows needed |
| Feature Feedback 4 | same | Variables (lines 570-572) | FF4-VAR-003 | Sample variables needed |
| Feature Feedback 4 | same | Connections (lines 574-576) | FF4-QA-006 | Unclear usage; documentation needed |
| Feature Feedback 4 | same | Logs (lines 578-580) | FF4-QA-007 | Logs working; use more |
| Feature Feedback 4 | same | Settings (lines 582-584) | FF4-QA-008 | Admin panels showing wrong devices |
| Feature Feedback 4 | same | Delivery/Versioning Model (lines 586-1663) | FF4-VER-001 through FF4-VER-009, FF4-APP-005 through FF4-APP-026, FF4-MOD-008 through FF4-MOD-015, FF4-TPL-004, FF4-TPL-005, FF4-TPL-006 | Full versioning model: terminology, naming, tree, entities, module/app editor behavior, preview, publish, mobile, templates, validation, API surface, UI, edge cases, acceptance criteria |
| Feature Feedback 4 | same | Backend / Deployment Plan (lines 1664-1747) | FF4-BE-001 through FF4-BE-006 | Bundled deployment, dev vs prod, Docker, fallback |
| Feature Feedback 4 | same | MCP/agents (lines 1748-1750) | FF4-MCP-001, FF4-MCP-002 | MCP completion, AI-ready, QA integration |
| Feature Feedback 4 | same | Others (lines 1752-1801) | FF4-QA-004 | Research findings: react-doctor integration |
| Frontend Spec (codebase-explanation) | `docs/codebase-explanation/frontend.md` | FF4 Changes / FF4 Reassessment (lines 611-689) | FF4-CELL-004, FF4-CAL-022, FF4-CAL-023, FF4-CAL-024, FF4-CAL-025, FF4-EC-005, FF4-MOD-016, FF4-VER-009, FF4-ROW-013, FF4-ROW-014, FF4-ROW-012, FF4-BE-014 | Cell width engine, row context menu, version diff, calendar mobile changes, Empty container props, cleanup |
| Backend Spec (codebase-explanation) | `docs/codebase-explanation/backend.md` | FF4 Changes (lines 680-771) | FF4-BE-007, FF4-BE-008, FF4-BE-009, FF4-BE-010, FF4-BE-011, FF4-BE-012, FF4-BE-013, FF4-BE-016, FF4-BE-017 | Versioning endpoints, new models, MCP tools, WebSocket events, cleanup service |
| Protocol Spec (codebase-explanation) | `docs/codebase-explanation/protocol.md` | FF4 Changes (lines 86-97, 253-265, 379-385) | FF4-CAL-012 (event shape), FF4-CAL-024 (sourceType), FF4-CAL-025 (notes), FF4-VER-004 (entity model ref) | CalendarEvent source_type + notes, SDUI versioning flow, cell width percentage |
| Migration Notes | `docs/ai/migration-notes.md` | Document FF4 Reassessment Changes (lines 382-395) | FF4-CAL-022, FF4-CAL-023, FF4-CAL-024, FF4-CAL-025, FF4-EC-005, FF4-BE-014, FF4-ROW-007, FF4-MOD-016, FF4-VER-009 | Summary of FF4 Reassessment changes |
