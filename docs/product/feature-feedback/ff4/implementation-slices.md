# Implementation Slices

Domain-cohesive implementation groupings with dependency ordering.

**Status:** Populated

---

## Slice: FF4-SLICE-BACKEND
**Domain:** Backend — API endpoints, services, data models, deployment
**Dependencies:** None (foundational slice)
**Suggested order:** 1
**Requirements:** FF4-BE-001, FF4-BE-002, FF4-BE-003, FF4-BE-004, FF4-BE-005, FF4-BE-006, FF4-BE-007, FF4-BE-008, FF4-BE-009, FF4-BE-010, FF4-BE-011, FF4-BE-012, FF4-BE-013, FF4-BE-014, FF4-BE-015, FF4-BE-016, FF4-BE-017, FF4-DES-001
**Description:** Backend infrastructure: bundled deployment, API endpoints for apps/modules/templates/devices/preview sessions, versioning endpoints (checkpoints, versions, restore, publish), validation service, cleanup service, sample data seeding, WebSocket events (preview_session_started, app_version_published), MCP tools (helm_create_checkpoint, helm_list_module_versions, helm_restore_version, helm_publish_version), screen history migration. This slice establishes the data models and API surface that all other slices depend on.

---

## Slice: FF4-SLICE-ROWS-CELLS-LAYOUT
**Domain:** Rows & Cells — Layout engine, cell width validation, drag behavior
**Dependencies:** FF4-SLICE-BACKEND (for SDUI JSON save/load)
**Suggested order:** 2
**Requirements:** FF4-ROW-001, FF4-ROW-002, FF4-ROW-003, FF4-ROW-004, FF4-ROW-005, FF4-ROW-006, FF4-ROW-007, FF4-ROW-008, FF4-ROW-009, FF4-ROW-010, FF4-ROW-011, FF4-ROW-012, FF4-ROW-013, FF4-ROW-014, FF4-ROW-015, FF4-CELL-001, FF4-CELL-002, FF4-CELL-003, FF4-CELL-004
**Description:** Row/cell management and layout engine: cell width percentage calculation (auto/fixed/mixed rules), minimum width enforcement (80px via pre-flight validation), action blocking (disabled controls before invalid states), horizontal scrolling rule (off→no overflow, on→min width still applies), all-fixed-width centering vs mixed auto-fill rules, validation timing for 12+ operations, row drag handles (left side, smooth), row resize handles (no lag), row simplification (remove padding/gap/background), cell resize behavior (follow cursor, no jumping), delete button positioning (left side), fit-the-cell enforcement for all components, min drag limits (prevent below minimum, no bounce-back).

---

## Slice: FF4-SLICE-VERSIONING
**Domain:** Versioning — Version history, checkpoints, diff, comparison
**Dependencies:** FF4-SLICE-BACKEND (for versioning API)
**Suggested order:** 3
**Requirements:** FF4-VER-001, FF4-VER-002, FF4-VER-003, FF4-VER-004, FF4-VER-005, FF4-VER-006, FF4-VER-007, FF4-VER-008, FF4-VER-009
**Description:** Versioning model: terminology (Working Draft, Checkpoint, Version, Live Version, Preview Session, Publish, Restore, Pin, Use newest), timestamp-based naming (no v1/v2/v3), version tree display (parent-child, not flat list), entity model (App/Module/PreviewSession/Device updates), published version snapshot reproducibility, multi-stage validation (autosave → checkpoint → preview → publish with exact error locations), Version History UI (tree view, status/source badges, rename/restore/compare/archive actions), version comparison/diff UI (row counts, component counts, added/removed types).

---

## Slice: FF4-SLICE-MODULE-EDITOR
**Domain:** Module Editor — Document-style editing, autosave, checkpoints, web preview
**Dependencies:** FF4-SLICE-BACKEND, FF4-SLICE-ROWS-CELLS-LAYOUT, FF4-SLICE-VERSIONING
**Suggested order:** 4
**Requirements:** FF4-MOD-001, FF4-MOD-002, FF4-MOD-003, FF4-MOD-004, FF4-MOD-005, FF4-MOD-006, FF4-MOD-007, FF4-MOD-008, FF4-MOD-009, FF4-MOD-010, FF4-MOD-011, FF4-MOD-012, FF4-MOD-013, FF4-MOD-014, FF4-MOD-015, FF4-MOD-016
**Description:** Module Editor behavior: rename from Visual Editor, collapsible sidebar, top bar (Module: {name}, Saved time, Create Checkpoint, Preview in Web Admin, Version History — NO Draft/Approve/Reject), autosave with debounce and save state display, checkpoint creation (triggers: manual, before template apply, before restore), web-admin-only module preview (SDUI renderer close to mobile, viewport size, inline validation warnings), version creation for App Editor references, restore to working draft (no auto-publish), row context menu (Add Above/Below, Duplicate, Delete with confirmation), right-click module context menu, save button enabled for new modules, templates use only valid components.

---

## Slice: FF4-SLICE-APP-EDITOR
**Domain:** App Editor — App composition, preview, publish, module references
**Dependencies:** FF4-SLICE-BACKEND, FF4-SLICE-MODULE-EDITOR, FF4-SLICE-VERSIONING
**Suggested order:** 5
**Requirements:** FF4-APP-001, FF4-APP-002, FF4-APP-003, FF4-APP-004, FF4-APP-005, FF4-APP-006, FF4-APP-007, FF4-APP-008, FF4-APP-009, FF4-APP-010, FF4-APP-011, FF4-APP-012, FF4-APP-013, FF4-APP-014, FF4-APP-015, FF4-APP-016, FF4-APP-017, FF4-APP-018, FF4-APP-019, FF4-APP-020, FF4-APP-021, FF4-APP-022, FF4-APP-023, FF4-APP-024, FF4-APP-025, FF4-APP-026, FF4-APP-027
**Description:** App Editor behavior: module icon configuration, push-to-sync (all edits → backend JSON), simplified mobile preview (center + bottom bar, no two sidebars), dark mode sync to mobile, top bar (App: {name}, Saved time, Live version, Preview dropdown, Publish, Version History), module reference selector (Use newest/Use specific version), published version snapshot reproducibility, publish modal with validation results and device status, full app web preview, temporary mobile preview sessions (Preview Mode indicator, exit returns to live), publish flow (immutable version, device notification via WebSocket + REST fetch), mobile live behavior (cache last known good, offline support, atomic updates), device update protocol (WS notification only, REST fetch for data), edge cases (edit used module, deleted version warning, offline publish, incompatible device, preview failure, restore old version), cleanup test data capability.

---

## Slice: FF4-SLICE-COMPONENTS
**Domain:** Components — Text, Markdown, Button, Image, Icon, Empty Container, Variables, Notes, InputBar, Todo, ArticleCard, RichText
**Dependencies:** FF4-SLICE-BACKEND, FF4-SLICE-ROWS-CELLS-LAYOUT
**Suggested order:** 6
**Requirements:** FF4-TEXT-001, FF4-TEXT-002, FF4-TEXT-003, FF4-TEXT-004, FF4-TEXT-005, FF4-BTN-001, FF4-BTN-002, FF4-BTN-003, FF4-IMG-001, FF4-IMG-002, FF4-ICON-001, FF4-EC-001, FF4-EC-002, FF4-EC-003, FF4-EC-004, FF4-EC-005, FF4-VAR-001, FF4-VAR-002, FF4-VAR-003, FF4-NOTES-001, FF4-NOTES-002, FF4-NOTES-003, FF4-NOTES-004, FF4-IB-001, FF4-TODO-001, FF4-TODO-002, FF4-DES-002
**Description:** All UI components: merge Text+Markdown → new markdown-based Text (react-native-markdown-display, enter key fix, alignment, variable compatibility, template migration), Button (fill cell, fix icon mode), Image (simplify to src+fitMode+action only, fitWidth/fitHeight), Icon (fix picker, fill cell centered), Empty Container (vertical row, no separate system, remove gap/padding/background, SDUI V2 dispatch+dataBinding, Daily Planner test case), Variable system (fix hit box, end-to-end display, QA coverage, sample variables), Notes (first-class component, local-first SQLite, markdown rendering, AI notes read-only, template integration), InputBar (send action to backend with content), Todo/ArticleCard/RichText (make functional, real data binding, no custom components), Chat (deferred).

---

## Slice: FF4-SLICE-CALENDAR
**Domain:** Calendar — Calendar integration, variants, events, OAuth
**Dependencies:** FF4-SLICE-BACKEND, FF4-SLICE-COMPONENTS (for unified component patterns)
**Suggested order:** 7
**Requirements:** FF4-CAL-001 through FF4-CAL-025
**Description:** Calendar component: first-class real component with 5 admin-controlled variants (Month, Week, Day, Event List, Compact), variant control (admin-only, no mobile switcher), date navigation (◀ range ▶ Today built-in), fit-the-cell (auto-adapt Compact/Event List for small cells <200px, validation warning for unfittable variants), Month variant (7-col grid, colored dots, tap date→agenda list, tap event→details), Week/Day variants (time-block grid 00:00–23:59, positioned event blocks, overlap handling), 3-day view (deferred), unified event model (id/title/start/end/allDay/sourceId/sourceName/sourceType/sourceColor/properties), local-first architecture (SQLite events table, remote sync via connector layer), sources (Local→CalDAV→Notion→Custom), color rule (auto-assigned per source, consistent across all variants), filtering (admin-configured sources/categories), data binding (real data, not mock), libraries (react-native-calendars + react-native-big-calendar behind Helm interface), inspector fields (variant, sources, filters, max events, metadata options), template usage (Personal Dashboard 50/50, Daily Planner Empty Container), sourceType badges (colored), notes display (2 lines truncated).

---

## Slice: FF4-SLICE-TEMPLATES
**Domain:** Templates — Template management, versioning, duplication, apply flow
**Dependencies:** FF4-SLICE-BACKEND, FF4-SLICE-COMPONENTS, FF4-SLICE-VERSIONING
**Suggested order:** 8
**Requirements:** FF4-TPL-001, FF4-TPL-002, FF4-TPL-003, FF4-TPL-004, FF4-TPL-005, FF4-TPL-006
**Description:** Template management: functional templates using only real components, two-step process (backend complete → send JSON), versioned template sources (timestamped names, renamable), template apply flow (apply→Module Working Draft, create checkpoint before applying to existing module), template apply modal (version selector, target new/existing, checkpoint confirmation), Template UI (version selector, apply options, auto-checkpoint, no mobile publish), template validation (seed screen_json validated at startup, non-existent components flagged).

---

## Slice: FF4-SLICE-WORKFLOWS
**Domain:** Workflows — Workflow editor, test workflows, branching
**Dependencies:** FF4-SLICE-BACKEND (for workflow engine)
**Suggested order:** 9
**Requirements:** FF4-WF-001, FF4-WF-002
**Description:** Workflow system: test workflows available for inspection and testing ("Daily Summary" 9am notification, "Event Reminder" 15 min before events, "New Todo Alert"), workflows must be visually verifiable and executable. Sample workflows seeded as data.

---

## Slice: FF4-SLICE-MCP-QA
**Domain:** MCP & QA — MCP tools, QA coverage, test infrastructure, cleanup
**Dependencies:** FF4-SLICE-BACKEND, FF4-SLICE-CALENDAR (for calendar data binding tests)
**Suggested order:** 10 (parallel with Templates and Workflows)
**Requirements:** FF4-MCP-001, FF4-MCP-002, FF4-QA-001, FF4-QA-002, FF4-QA-003, FF4-QA-004, FF4-QA-005, FF4-QA-006, FF4-QA-007, FF4-QA-008, FF4-DES-003
**Description:** MCP completion and QA integration: MCP must be AI-ready with full tool support for sub-agents, integrated into QA system. QA coverage: variable system comprehensive tests, live testing for App Editor features, test data cleanup (no leftover Test App/New App junk), react-doctor integration into Reviewer agent, app preview functional for layout testing, Connections usage documentation, Logs validation, Settings device list corrected to show only frontend devices.
