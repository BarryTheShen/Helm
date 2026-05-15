# QA Plan

QA coverage classification per REQ-ID with concrete checks.

**Status:** Populated (structure — concrete test scripts to be written by helm-tester)

| REQ-ID | QA Mode | Test Strategy | Evidence Type | Owner |
|--------|---------|---------------|---------------|-------|
| FF4-APP-001 | manual-flow-test | Manual: Open App Editor → select module → verify icon area is configurable | Screenshot of icon picker | helm-tester |
| FF4-APP-002 | automated-test | Playwright: Edit App Editor settings → save → verify backend GET returns updated JSON | API assertion | helm-tester |
| FF4-APP-003 | manual-flow-test | Manual: Open App Editor → verify phone preview layout (center + bottom bar only) | Screenshot | helm-tester |
| FF4-APP-004 | manual-flow-test | Manual: Set dark mode in App Editor → publish → verify mobile renders dark | Screenshot mobile | helm-tester |
| FF4-APP-005 | manual-flow-test | Manual: Edit module → verify mobile does NOT change; Publish app → verify mobile updates | Flow recording | helm-tester |
| FF4-APP-006 | manual-flow-test | Manual: Open App Editor → verify top bar elements | Screenshot | helm-tester |
| FF4-APP-007 | manual-flow-test | Manual: Open App Editor → verify module reference UI with Use newest/Use specific | Screenshot | helm-tester |
| FF4-APP-008 | automated-test | Playwright: Set module to "Use newest" → publish → verify published version stores concrete module version ID | API assertion + DB check | helm-tester |
| FF4-APP-009 | automated-test | Playwright: Pin module version → edit module → verify app unchanged; Change pin → publish → verify update | API assertion | helm-tester |
| FF4-APP-010 | automated-test | Playwright: Publish app → verify stored JSON has policy + resolvedModuleVersionId; Restore old version → verify exact versions used | API assertion | helm-tester |
| FF4-APP-011 | manual-flow-test | Manual: Click Publish → verify modal content (app name, version, devices, modules, validation) | Screenshot | helm-tester |
| FF4-APP-012 | manual-flow-test | Manual: Verify all listed App Editor UI elements are present | Screenshot | helm-tester |
| FF4-APP-013 | manual-flow-test | Manual: Open module settings in App Editor → verify icon picker works | Screenshot | helm-tester |
| FF4-APP-014 | manual-flow-test | Manual: Click "Preview in Web Admin" from App Editor → verify full app with bottom bar, Launchpad, theme | Screenshot | helm-tester |
| FF4-APP-015 | manual-flow-test | Manual: Click "Preview on Device" → select device → verify mobile enters Preview Mode with indicator | Screenshot mobile | helm-tester |
| FF4-APP-016 | automated-test | Playwright+pytest: Create preview session → verify expiry behavior, active_app_version_id unchanged, error logging | API assertion | helm-tester |
| FF4-APP-017 | automated-test | Playwright+pytest: Publish → verify App Version created, WS event sent, device fetches and switches | API + WS assertion | helm-tester |
| FF4-APP-018 | manual-flow-test | Manual: Launch mobile app → verify fetches published version; Go offline → verify cached version renders | Manual test | helm-tester |
| FF4-APP-019 | automated-test | pytest: Publish → verify WS event app_version_published sent; verify device fetches via REST | WS + API assertion | helm-tester |
| FF4-APP-020 | manual-flow-test | Manual: Open app preview → verify rendering close to React Native experience | Screenshot comparison | helm-tester |
| FF4-APP-021 | automated-test | pytest: Edit module used by live app → verify live app unchanged; Publish app with module → verify update | API assertion | helm-tester |
| FF4-APP-022 | manual-flow-test | Manual: Archive module version used by app → verify warning in App Editor | Screenshot | helm-tester |
| FF4-APP-023 | automated-test | pytest: Publish with device offline → verify publish succeeds, device updates on reconnect | API assertion | helm-tester |
| FF4-APP-024 | manual-flow-test | Manual: Publish version with unsupported component → verify device keeps old version, admin shows error | Manual test | helm-tester |
| FF4-APP-025 | automated-test | pytest: Force preview failure → verify device returns to live, backend logs | API assertion | helm-tester |
| FF4-APP-026 | automated-test | pytest: Restore old app version → verify draft updated, mobile unchanged, publish required | API assertion | helm-tester |
| FF4-APP-027 | automated-test | Playwright+pytest: Run cleanup preview/execute → verify test data removed | API assertion | helm-tester |
| FF4-MOD-001 | review-only | Code review: Verify "Module Editor" label used consistently, no "Visual Editor" | Code inspection | helm-reviewer |
| FF4-MOD-002 | manual-flow-test | Manual: Verify sidebar collapsible behavior in Module Editor | Screenshot | helm-tester |
| FF4-MOD-003 | manual-flow-test | Manual: Verify top bar does NOT show Draft v1/Approve/Reject | Screenshot | helm-tester |
| FF4-MOD-004 | manual-flow-test | Manual: Create new module → verify save button enabled → save → verify module persisted | Flow recording | helm-tester |
| FF4-MOD-005 | manual-flow-test | Manual: Open module preview → verify rendering close to React Native experience | Screenshot | helm-tester |
| FF4-MOD-006 | manual-flow-test | Manual: Right-click module → verify context menu with delete → verify delete works | Screenshot | helm-tester |
| FF4-MOD-007 | automated-test | pytest: Load all templates → verify all component types in component registry | API + validation | helm-tester |
| FF4-MOD-008 | review-only | Code review: Module Editor owns listed responsibilities; no app-level controls present | Code inspection | helm-reviewer |
| FF4-MOD-009 | manual-flow-test | Manual: Verify Module Editor top bar shows Module selector, Saved time, Create Checkpoint, Preview, Version History | Screenshot | helm-tester |
| FF4-MOD-010 | manual-flow-test | Manual: Edit module → verify autosave triggers with debounce → verify save state display (Saving.../Saved/Save failed) | Flow recording | helm-tester |
| FF4-MOD-011 | manual-flow-test | Manual: Click Create Checkpoint → verify checkpoint created with timestamp name; Apply template to existing module → verify auto-checkpoint | Flow recording | helm-tester |
| FF4-MOD-012 | manual-flow-test | Manual: Click Preview in Web Admin → verify module-only preview, no mobile preview | Screenshot | helm-tester |
| FF4-MOD-013 | automated-test | pytest: Create module checkpoint → verify version appears in App Editor selector; verify mobile unchanged | API assertion | helm-tester |
| FF4-MOD-014 | automated-test | pytest: Restore old module version → verify draft replaced with version SDUI JSON; verify no mobile publish | API assertion | helm-tester |
| FF4-MOD-015 | manual-flow-test | Manual: Verify all listed Module Editor UI elements present; verify no mobile preview/publish/approve controls | Screenshot | helm-tester |
| FF4-MOD-016 | manual-flow-test | Manual: Right-click row → verify Add Above/Below, Duplicate, Delete; verify Delete confirmation | Screenshot | helm-tester |
| FF4-ROW-001 | manual-flow-test | Manual: Verify 6-dot drag handle on left of each row, outside row boundary; drag to reorder | Screenshot | helm-tester |
| FF4-ROW-002 | manual-flow-test | Manual: Drag row height handle → verify boundary follows cursor in real-time | Flow recording | helm-tester |
| FF4-ROW-003 | automated-test | Playwright: Create row with fixed+auto cells → verify calculated percentages (e.g., 50%+auto+auto = 50/25/25) | UI assertion | helm-tester |
| FF4-ROW-004 | automated-test | Playwright: Set padding to high value → verify Add Cell greyed out when cells would drop below min width | UI assertion | helm-tester |
| FF4-ROW-005 | automated-test | Playwright: Attempt invalid operation → verify blocked before visual change | UI assertion | helm-tester |
| FF4-ROW-006 | automated-test | Playwright: Check each disabled state scenario: Add Cell, width increase, padding increase, resize, scroll toggle | UI assertion (disabled state) | helm-tester |
| FF4-ROW-007 | automated-test | Playwright: Toggle horizontal scroll off → attempt overflow action → verify blocked with warning | UI assertion | helm-tester |
| FF4-ROW-008 | automated-test | Playwright: Set all cells fixed (30%+30%) → verify cells center with side padding | Screenshot | helm-tester |
| FF4-ROW-009 | automated-test | Playwright: Set mixed (50%+auto) → verify auto cell fills remaining 50%, no side padding | Screenshot | helm-tester |
| FF4-ROW-010 | automated-test | Playwright: Perform each operation in list → verify validation runs and blocks invalid states | UI assertion | helm-tester |
| FF4-ROW-011 | automated-test | Playwright+pytest: Load invalid saved row → verify validation error shown; attempt publish → verify refused | API + UI assertion | helm-tester |
| FF4-ROW-012 | manual-flow-test | Manual: Place component in cell → verify component fills entire cell area; resize cell → verify component resizes | Screenshot | helm-tester |
| FF4-ROW-013 | review-only | Code review: Verify row property inspector has no padding/gap controls; verify SDUI JSON has no padding/gap | Code inspection | helm-reviewer |
| FF4-ROW-014 | review-only | Code review: Verify row property inspector has no background color control; verify SDUI JSON has no backgroundColor | Code inspection | helm-reviewer |
| FF4-ROW-015 | manual-flow-test | Manual: Drag row height below 48px or cell width below min → verify handle stops at minimum, no bounce-back | Flow recording | helm-tester |
| FF4-CELL-001 | manual-flow-test | Manual: Drag cell divider → verify it follows cursor; verify adjacent cells don't jump | Flow recording | helm-tester |
| FF4-CELL-002 | manual-flow-test | Manual: Verify row delete button on left, cell delete buttons on left, no overlap | Screenshot | helm-tester |
| FF4-CELL-003 | manual-flow-test | Manual: Add 7th cell when width allows → verify allowed; test when width insufficient → verify blocked | Flow recording | helm-tester |
| FF4-CELL-004 | manual-flow-test | Manual: Place various components in cells → verify all fill cell area | Screenshot (multiple) | helm-tester |
| FF4-VAR-001 | manual-flow-test | Manual: Insert variable → verify displayed in preview; verify hit box is proportional | Screenshot | helm-tester |
| FF4-VAR-002 | automated-test | Playwright: Comprehensive variable test: insert, display, edge cases across components | UI assertion | helm-tester |
| FF4-VAR-003 | automated-test | pytest: Verify sample variables (user.name, app.theme, greeting.morning) are seeded and resolve | API assertion | helm-tester |
| FF4-TEXT-001 | review-only | Code review: Verify Text is markdown-based; verify no separate Markdown component; verify old Markdown mapped to Text | Code inspection | helm-reviewer |
| FF4-TEXT-002 | manual-flow-test | Manual: Type multi-line markdown in Text inspector → verify Enter creates new lines in preview | Screenshot | helm-tester |
| FF4-TEXT-003 | manual-flow-test | Manual: Set Text alignment to center → verify rendered markdown is centered | Screenshot | helm-tester |
| FF4-TEXT-004 | automated-test | pytest: Load all templates → verify no old Text/Markdown references; verify all use new Text | API assertion | helm-tester |
| FF4-TEXT-005 | automated-test | pytest+Playwright: Insert variable in Text markdown content → verify rendered markdown shows resolved value | UI assertion | helm-tester |
| FF4-BTN-001 | manual-flow-test | Manual: Place button in cell → verify button fills entire cell area at any cell size | Screenshot | helm-tester |
| FF4-BTN-002 | manual-flow-test | Manual: Configure button with icon mode → verify icon renders centered and visible | Screenshot | helm-tester |
| FF4-BTN-003 | manual-flow-test | Manual: Load template with configured button actions → verify actions work end-to-end | Flow recording | helm-tester |
| FF4-IMG-001 | manual-flow-test | Manual: Place image in cell with fitWidth → verify scales to cell width; test fitHeight | Screenshot | helm-tester |
| FF4-IMG-002 | review-only | Code review: Verify Image inspector shows only src, fitMode, action; removed props absent | Code inspection | helm-reviewer |
| FF4-ICON-001 | manual-flow-test | Manual: Click icon → verify emoji picker opens; select emoji → verify renders centered in cell | Screenshot | helm-tester |
| FF4-EC-001 | manual-flow-test | Manual: Place Empty Container in cell → verify vertical row behavior: add sub-cells, reorder, validation | Flow recording | helm-tester |
| FF4-EC-002 | review-only | Code review: Verify Empty Container is real editable component, not hidden wrapper | Code inspection | helm-reviewer |
| FF4-EC-003 | review-only | Code review: Verify Empty Container has no gap/padding/background controls | Code inspection | helm-reviewer |
| FF4-EC-004 | manual-flow-test | Manual: Load Daily Planner template with Empty Container → verify Calendar/Todo/Notes stacked vertically and functional | Screenshot | helm-tester |
| FF4-EC-005 | automated-test | Playwright: Configure Empty container with dispatch action → verify action dispatches; test dataBinding integration | UI assertion | helm-tester |
| FF4-CAL-001 | manual-flow-test | Manual: Verify Calendar is in component registry as real component with variant selector | Screenshot | helm-tester |
| FF4-CAL-002 | manual-flow-test | Manual: Test each of 5 variants → verify real layouts rendered (not placeholders) | Screenshots (5) | helm-tester |
| FF4-CAL-003 | manual-flow-test | Manual: Test Event List → verify vertical list with title/time/source color; test filters | Screenshot | helm-tester |
| FF4-CAL-004 | manual-flow-test | Manual: Test Compact variant in 50/50 cell → verify event count + next event displayed | Screenshot | helm-tester |
| FF4-CAL-005 | manual-flow-test | Manual: Verify mobile Calendar has no variant switcher; only prev/next/Today navigation | Screenshot mobile | helm-tester |
| FF4-CAL-006 | manual-flow-test | Manual: Verify date navigation header for each variant (◀ range ▶ Today) | Screenshot | helm-tester |
| FF4-CAL-007 | manual-flow-test | Manual: Place Calendar in small cell → verify auto-adapt; place variant too large → verify validation warning | Screenshot | helm-tester |
| FF4-CAL-008 | manual-flow-test | Manual: Test Month variant: tap date → agenda list; tap event → details | Flow recording | helm-tester |
| FF4-CAL-009 | manual-flow-test | Manual: Test Week/Day: verify time-block grid with positioned event blocks; test arrows | Flow recording | helm-tester |
| FF4-CAL-010 | deferred | Deferred for future implementation | N/A | N/A |
| FF4-CAL-011 | manual-flow-test | Manual: Tap event → verify detail surface with title/time/source/notes; test Notion event detail | Screenshot | helm-tester |
| FF4-CAL-012 | automated-test | pytest: Fetch events → verify unified event shape (id/title/start/end/allDay/sourceType/sourceColor/properties) | API assertion | helm-tester |
| FF4-CAL-013 | automated-test | pytest+Playwright: Verify local events exist; verify Calendar reads from local/unified model | API + UI assertion | helm-tester |
| FF4-CAL-014 | manual-flow-test | Manual: Verify local events display; (CalDAV/Notion deferred) | Manual test | helm-tester |
| FF4-CAL-015 | manual-flow-test | Manual: Verify source color consistent across Month dots, Week/Day blocks, Event List, detail header | Screenshot | helm-tester |
| FF4-CAL-016 | manual-flow-test | Manual: Configure Calendar filters → verify only matching events displayed | Screenshot | helm-tester |
| FF4-CAL-017 | automated-test | Playwright: Verify real event data displays in all variants (no mock data) | UI assertion | helm-tester |
| FF4-CAL-018 | review-only | Code review: Verify react-native-calendars and react-native-big-calendar used through Helm's interface | Code inspection | helm-reviewer |
| FF4-CAL-019 | manual-flow-test | Manual: Verify Calendar inspector has variant, sources, filters, max events, metadata options | Screenshot | helm-tester |
| FF4-CAL-020 | manual-flow-test | Manual: Load Personal Dashboard (Weather+Compact 50/50) and Daily Planner (Week in Empty Container) | Screenshots (2) | helm-tester |
| FF4-CAL-021 | automated-test | Playwright+pytest: End-to-end Calendar acceptance: all variants render real layouts, Compact works in small cells, events display, navigation works, detail opens | E2E flow | helm-tester |
| FF4-CAL-022 | manual-flow-test | Manual: Verify mobile Calendar has removed view switcher; only time navigation remains | Screenshot mobile | helm-tester |
| FF4-CAL-023 | manual-flow-test | Manual: Place Calendar in cell <200px → verify auto-adapts to Compact/Event List | Screenshot | helm-tester |
| FF4-CAL-024 | manual-flow-test | Manual: Verify source type badges: Local/Gray, CalDAV/Blue, Notion/Purple, Custom/Teal | Screenshot | helm-tester |
| FF4-CAL-025 | manual-flow-test | Manual: View event with notes → verify up to 2 lines displayed with truncation | Screenshot | helm-tester |
| FF4-TPL-001 | automated-test | pytest+Playwright: Apply template JSON → verify renders with all functional features | API + UI assertion | helm-tester |
| FF4-TPL-002 | automated-test | pytest: Validate all template component types against registry on load | API assertion | helm-tester |
| FF4-TPL-003 | automated-test | pytest: Verify templates stored as JSON; verify apply via API renders correctly | API assertion | helm-tester |
| FF4-TPL-004 | automated-test | pytest: Apply template to existing module → verify checkpoint created; verify module draft updated (not live mobile) | API assertion | helm-tester |
| FF4-TPL-005 | manual-flow-test | Manual: Click Apply Template → verify modal with version selector, target, checkpoint option | Screenshot | helm-tester |
| FF4-TPL-006 | manual-flow-test | Manual: Verify Template UI has version selector, apply options, auto-checkpoint; no mobile publish | Screenshot | helm-tester |
| FF4-WF-001 | manual-flow-test | Manual: Open Workflows page → verify sample workflows visible; run workflow → verify execution | Screenshot | helm-tester |
| FF4-WF-002 | automated-test | pytest: Verify sample workflows seeded (Daily Summary, Event Reminder, New Todo Alert); verify trigger behavior | API assertion | helm-tester |
| FF4-VER-001 | review-only | Code review: Verify all versioning terminology used consistently; no Draft v1/Approve/Reject | Code inspection | helm-reviewer |
| FF4-VER-002 | automated-test | pytest: Create checkpoint → verify default timestamp name format; rename → verify custom name stored | API assertion | helm-tester |
| FF4-VER-003 | manual-flow-test | Manual: Open Version History → verify tree view with parent-child, status badges, live/used indicators | Screenshot | helm-tester |
| FF4-VER-004 | review-only | Code review: Verify all entity models exist with specified fields (App, AppWorkingDraft, AppVersion, Module, ModuleWorkingDraft, ModuleVersion, Template, TemplateVersion, Device, PreviewSession) | DB schema inspection | helm-reviewer |
| FF4-VER-005 | automated-test | pytest: Publish app with Use newest → verify stored version has concrete resolved module version IDs | API assertion | helm-tester |
| FF4-VER-006 | automated-test | pytest: Test validation at autosave, checkpoint, preview, publish stages → verify each blocks invalid states | API assertion | helm-tester |
| FF4-VER-007 | manual-flow-test | Manual: Attempt publish with invalid component → verify error shows Module→Row→Cell→Component path + fix guidance | Screenshot | helm-tester |
| FF4-VER-008 | manual-flow-test | Manual: Open Version History → verify tree view, badges, actions (Rename/Restore/Compare/Archive/View JSON), used-by panel | Screenshot | helm-tester |
| FF4-VER-009 | manual-flow-test | Manual: Click Compare Versions with ≥2 versions → verify side-by-side diff: row counts, component counts, added/removed types | Screenshot | helm-tester |
| FF4-BE-001 | automated-test | Docker: Deploy bundled container → verify single port serves admin, API, WS, MCP | Docker smoke test | helm-tester |
| FF4-BE-002 | review-only | Code review: Verify bundled deployment implementation fits existing architecture | Code inspection | helm-reviewer |
| FF4-BE-003 | automated-test | Verify dev hot reload works; verify production single-port deployment works | Manual dev + Docker test | helm-tester |
| FF4-BE-004 | automated-test | Docker: `docker compose up` → verify single container, single port, data persistence | Docker smoke test | helm-tester |
| FF4-BE-005 | automated-test | Docker: Verify all acceptance criteria pass (admin at /, API, WS, MCP, admin routing after refresh, dev hot reload) | Docker + dev test | helm-tester |
| FF4-BE-006 | review-only | Code review: Verify deployment can be separated back into frontend + backend | Code inspection | helm-reviewer |
| FF4-BE-007 | automated-test | pytest: Verify all listed API endpoints exist and respond correctly (Apps, Modules, Templates, Devices, Preview Sessions) | API test | helm-tester |
| FF4-BE-008 | review-only | Code review: Verify new and enhanced data models match specification | DB schema inspection | helm-reviewer |
| FF4-BE-009 | automated-test | pytest: Verify all versioning endpoints exist (module/app draft, checkpoints, versions, restore, rename, preview, publish) | API test | helm-tester |
| FF4-BE-010 | automated-test | pytest: Verify validation_service.py performs autosave/checkpoint/preview/publish validation | Unit test | helm-tester |
| FF4-BE-011 | automated-test | pytest: Verify sample workflows, variables, calendar events are seeded on startup | API assertion | helm-tester |
| FF4-BE-012 | automated-test | pytest: Verify all template seed screen_json validated at startup; verify warnings logged for invalid | Log assertion | helm-tester |
| FF4-BE-013 | automated-test | pytest: Verify new versioning code writes to module_versions; verify old sdui_screen_history still accessible | API assertion | helm-tester |
| FF4-BE-014 | automated-test | pytest: Call GET /api/admin/cleanup/preview → verify test data counts; POST /api/admin/cleanup/execute → verify deletion | API assertion | helm-tester |
| FF4-BE-015 | manual-flow-test | Manual: Walk the full canonical flow → verify module editor never pushes to mobile | Flow recording | helm-tester |
| FF4-BE-016 | automated-test | pytest: Create preview session → verify preview_session_started WS event; Publish → verify app_version_published WS event | WS assertion | helm-tester |
| FF4-BE-017 | automated-test | pytest: Call helm_create_checkpoint, helm_list_module_versions, helm_restore_version, helm_publish_version MCP tools | MCP assertion | helm-tester |
| FF4-MCP-001 | automated-test | pytest: Verify MCP server is complete; verify all MCP tools registered; verify QA integration | MCP assertion | helm-tester |
| FF4-MCP-002 | automated-test | pytest: Simulate AI agent connecting to MCP → verify create/edit frontend apps via MCP | MCP assertion | helm-tester |
| FF4-QA-001 | automated-test | Playwright+pytest: Comprehensive variable QA script covering insertion, display, rendering, edge cases | E2E test | helm-tester |
| FF4-QA-002 | manual-flow-test | Manual: Perform live testing of App Editor features on actual mobile device | Manual test | helm-tester |
| FF4-QA-003 | automated-test | pytest: Run cleanup after test suite → verify no test data remains | API assertion | helm-tester |
| FF4-QA-004 | automated-test | Run react-doctor diagnostics as part of Reviewer agent workflow | CLI output | helm-tester |
| FF4-QA-005 | manual-flow-test | Manual: Verify app preview is functional → test layout features (dividers, etc.) | Screenshot | helm-tester |
| FF4-QA-006 | review-only | Code review: Verify Connections documentation explains end-to-end usage | Doc inspection | helm-reviewer |
| FF4-QA-007 | manual-flow-test | Manual: Verify Logs page displays correctly and supports filtering | Screenshot | helm-tester |
| FF4-QA-008 | manual-flow-test | Manual: Verify Settings devices list shows only frontend/mobile devices | Screenshot | helm-tester |
| FF4-NOTES-001 | manual-flow-test | Manual: Test Notes component: list view with title/preview/author/timestamp; tap → full-page view; markdown rendering; user notes editable; AI notes read-only | Flow recording | helm-tester |
| FF4-NOTES-002 | automated-test | pytest+Playwright: Verify Notes reads/writes via backend API; verify local SQLite fallback | API + UI assertion | helm-tester |
| FF4-NOTES-003 | manual-flow-test | Manual: Load Home template → verify most recent note; Daily Planner → verify today's notes in Empty Container; "+ New Note" → verify calls notes.create | Flow recording | helm-tester |
| FF4-NOTES-004 | review-only | Code review: Verify V1 Notes has backend CRUD, real data, template integration; advanced features (Notion/Apple sync, image upload, etc.) not present | Code inspection | helm-reviewer |
| FF4-IB-001 | manual-flow-test | Manual: Type in Input Bar → click send → verify content sent to backend as server_action; test with variables | Flow recording | helm-tester |
| FF4-TODO-001 | automated-test | pytest+Playwright: Test Todo: add item → verify backend CRUD; toggle → verify completed; delete → verify removed; ArticleCard: verify real data + navigation; RichText: verify markdown rendering | API + UI assertion | helm-tester |
| FF4-TODO-002 | review-only | Code review: Verify Todo/ArticleCard/RichText use standard component registry and SDUI patterns | Code inspection | helm-reviewer |
| FF4-DES-001 | automated-test | pytest: Verify backend serves JSON configuration; verify admin modifications update served JSON | API assertion | helm-tester |
| FF4-DES-002 | deferred | Chat module deferred for future implementation | N/A | N/A |
| FF4-DES-003 | review-only | Code review: Verify Logs system captures sufficient detail for debugging | Code inspection | helm-reviewer |
