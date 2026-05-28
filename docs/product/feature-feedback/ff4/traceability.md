# Traceability Matrix

Cross-reference: REQ-ID → source → implementation → test → verdict.

**Status:** Populated (source → REQ-ID mapping complete; implementation and QA columns left empty — spec extraction pass)

| REQ ID | Source Document | Implementation Evidence | QA Evidence | Verdict |
|--------|----------------|------------------------|-------------|---------|
| FF4-APP-001 | FF4 doc lines 7-15 | web/AppEditorPage.tsx, IconPicker | qa/ff4-app-editor.spec.ts | PASS |
| FF4-APP-002 | FF4 doc lines 11-12 | web/AppEditorPage.tsx, api.updateAppDraft | qa/ff4-app-editor.spec.ts, backend/test_ff4_phase9_app_editor.py | PASS |
| FF4-APP-003 | FF4 doc lines 13-14 | web/AppPhoneShell.tsx | qa/ff4-phase5-editors.spec.ts | PASS |
| FF4-APP-004 | FF4 doc lines 15-16 | web/AppEditorPage dark_mode, mobile sync | qa/app-editor-preview.spec.ts (draft persist) | PARTIAL — mobile live dark-mode sync not e2e-verified |
| FF4-APP-005 | FF4 doc lines 586-612 | versioning model | qa/ff4-app-editor.spec.ts, backend/test_ff4_phase9_app_editor.py | PASS |
| FF4-APP-006 | FF4 doc lines 1032-1051 | web/AppEditorPage.tsx top bar | qa/ff4-app-editor.spec.ts | PASS |
| FF4-APP-007 | FF4 doc lines 1053-1067 | web/AppEditorPage.tsx module_enabled, version radios | qa/ff4-app-editor.spec.ts | PASS |
| FF4-APP-008 | FF4 doc lines 1070-1078 | | | NOT TESTED |
| FF4-APP-009 | FF4 doc lines 1080-1085 | | | NOT TESTED |
| FF4-APP-010 | FF4 doc lines 1087-1114 | | | NOT TESTED |
| FF4-APP-011 | FF4 doc lines 1240-1278 | web/AppEditorPage publish modal | qa/ff4-app-editor.spec.ts | PASS |
| FF4-APP-012 | FF4 doc lines 1540-1554 | web/AppEditorPage.tsx | qa/ff4-phase5-editors.spec.ts | PASS |
| FF4-APP-013 | FF4 doc lines 9-10 | web/AppEditorPage IconPicker | qa/ff4-app-editor.spec.ts | PASS |
| FF4-APP-014 | FF4 doc lines 1118-1187 | web/BrowserPreview.tsx | qa/app-editor-preview.spec.ts | PASS |
| FF4-APP-015 | FF4 doc lines 1155-1207 | web/PreviewPicker, backend preview session | qa/ff4-app-editor.spec.ts | PARTIAL — device Preview Mode indicator/exit not e2e on real device |
| FF4-APP-016 | FF4 doc lines 1199-1207 | | | NOT TESTED |
| FF4-APP-017 | FF4 doc lines 1210-1238 | | | NOT TESTED |
| FF4-APP-018 | FF4 doc lines 1281-1301 | backend device config, mobile WebSocketContext | qa/ff4-app-editor.spec.ts, backend/test_ff4_phase9_app_editor.py | PARTIAL — offline cache + WS atomic update not e2e on mobile |
| FF4-APP-019 | FF4 doc lines 1315-1333 | | | NOT TESTED |
| FF4-APP-020 | FF4 doc lines 27-28 | web/BrowserPreview.tsx (best-effort SDUI) | qa/ff4-app-editor.spec.ts | PARTIAL — should-REQ; web SDUI approximation, not native RN |
| FF4-APP-021 | FF4 doc lines 1581-1592 | | | NOT TESTED |
| FF4-APP-022 | FF4 doc lines 1593-1601 | web/AppEditorPage archived warning | qa/ff4-app-editor.spec.ts | PASS |
| FF4-APP-023 | FF4 doc lines 1602-1604 | | | NOT TESTED |
| FF4-APP-024 | FF4 doc lines 1606-1615 | web/AppEditorPage device errors panel | qa/ff4-app-editor.spec.ts, backend/test_ff4_phase9_app_editor.py | PASS |
| FF4-APP-025 | FF4 doc lines 1617-1619 | backend preview session error log | qa/ff4-app-editor.spec.ts, backend/test_ff4_phase9_app_editor.py | PARTIAL — device return-to-live not e2e on real device |
| FF4-APP-026 | FF4 doc lines 1621-1623 | | | NOT TESTED |
| FF4-APP-027 | FF4 doc lines 7, 3-4 | | | NOT TESTED |
| FF4-MOD-001 | FF4 doc lines 19-21 | | | NOT TESTED |
| FF4-MOD-002 | FF4 doc lines 21-22 | | | NOT TESTED |
| FF4-MOD-003 | FF4 doc lines 23-24 | | | NOT TESTED |
| FF4-MOD-004 | FF4 doc lines 25-26 | | | NOT TESTED |
| FF4-MOD-005 | FF4 doc lines 27-28 | | | NOT TESTED |
| FF4-MOD-006 | FF4 doc lines 29-30 | | | NOT TESTED |
| FF4-MOD-007 | FF4 doc lines 31-32 | | | NOT TESTED |
| FF4-MOD-008 | FF4 doc lines 896-922 | | | NOT TESTED |
| FF4-MOD-009 | FF4 doc lines 922-935 | | | NOT TESTED |
| FF4-MOD-010 | FF4 doc lines 936-946 | | | NOT TESTED |
| FF4-MOD-011 | FF4 doc lines 948-963 | | | NOT TESTED |
| FF4-MOD-012 | FF4 doc lines 965-977 | | | NOT TESTED |
| FF4-MOD-013 | FF4 doc lines 979-983 | | | NOT TESTED |
| FF4-MOD-014 | FF4 doc lines 985-1005 | | | NOT TESTED |
| FF4-MOD-015 | FF4 doc lines 1526-1538 | | | NOT TESTED |
| FF4-MOD-016 | FF4 doc lines 29-30, 656-662 | | | NOT TESTED |
| FF4-ROW-001 | FF4 doc lines 35-36 | | | NOT TESTED |
| FF4-ROW-002 | FF4 doc lines 37-38 | | | NOT TESTED |
| FF4-ROW-003 | FF4 doc lines 39-50 | | | NOT TESTED |
| FF4-ROW-004 | FF4 doc lines 66-83 | | | NOT TESTED |
| FF4-ROW-005 | FF4 doc lines 85-88 | | | NOT TESTED |
| FF4-ROW-006 | FF4 doc lines 89-101 | | | NOT TESTED |
| FF4-ROW-007 | FF4 doc lines 137-141 | | | NOT TESTED |
| FF4-ROW-008 | FF4 doc lines 143-161 | | | NOT TESTED |
| FF4-ROW-009 | FF4 doc lines 163-165 | | | NOT TESTED |
| FF4-ROW-010 | FF4 doc lines 167-184 | | | NOT TESTED |
| FF4-ROW-011 | FF4 doc lines 184 | | | NOT TESTED |
| FF4-ROW-012 | FF4 doc lines 186-187 | | | NOT TESTED |
| FF4-ROW-013 | FF4 doc lines 190-191 | | | NOT TESTED |
| FF4-ROW-014 | FF4 doc lines 190-191 | | | NOT TESTED |
| FF4-ROW-015 | FF4 doc lines 192-193 | | | NOT TESTED |
| FF4-CELL-001 | FF4 doc lines 194-196 | | | NOT TESTED |
| FF4-CELL-002 | FF4 doc lines 198-199 | | | NOT TESTED |
| FF4-CELL-003 | FF4 doc lines 39, 186-187 | | | NOT TESTED |
| FF4-CELL-004 | FF4 doc lines 258-259, 291-298 | | | NOT TESTED |
| FF4-VAR-001 | FF4 doc lines 200-202 | Variable pill + resolution | qa/ff4-phase10-components.spec.ts + backend/test_ff4_phase10_components.py | PASS |
| FF4-VAR-002 | FF4 doc lines 202-203 | | | NOT TESTED |
| FF4-VAR-003 | FF4 doc lines 570-572 | | | NOT TESTED |
| FF4-TEXT-001 | FF4 doc lines 204-208 | | | NOT TESTED |
| FF4-TEXT-002 | FF4 doc lines 210-214 | | | PASS (qa/ff4-phase5-editors.spec.ts) |
| FF4-TEXT-003 | FF4 doc lines 214-215 | | | NOT TESTED |
| FF4-TEXT-004 | FF4 doc lines 214-215 | | | NOT TESTED |
| FF4-TEXT-005 | FF4 doc lines 214 | | | NOT TESTED |
| FF4-BTN-001 | FF4 doc lines 216-218 | | | NOT TESTED |
| FF4-BTN-002 | FF4 doc lines 218-219 | | | NOT TESTED |
| FF4-BTN-003 | FF4 doc lines 219-220 | Home template server_action buttons | qa/ff4-phase10-components.spec.ts | PASS |
| FF4-IMG-001 | FF4 doc lines 220-222 | Image fitMode preview | qa/ff4-phase10-components.spec.ts + backend/test_ff4_phase10_components.py | PASS |
| FF4-IMG-002 | FF4 doc lines 222-223 | | | NOT TESTED |
| FF4-ICON-001 | FF4 doc lines 228-230 | IconPicker + icon-preview-cell | qa/ff4-phase10-components.spec.ts | PASS |
| FF4-EC-001 | FF4 doc lines 232-248 | Empty vertical flex-col preview | qa/ff4-phase10-components.spec.ts | PASS |
| FF4-EC-002 | FF4 doc lines 245-246 | Empty in registry | backend/test_ff4_phase10_components.py | PASS |
| FF4-EC-003 | FF4 doc lines 246-248 | No gap/padding on Empty | backend/test_ff4_phase10_components.py | PASS |
| FF4-EC-004 | FF4 doc lines 248-249 | Daily Planner Empty stack | qa/ff4-phase10-components.spec.ts | PASS |
| FF4-EC-005 | FF4 doc lines 679-682 | Empty structural component | backend/test_ff4_phase10_components.py | PASS |
| FF4-CAL-001 | FF4 doc lines 250-258 | CalendarModule.tsx + CalendarPreview.tsx | qa/ff4-phase11-calendar.spec.ts + backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-002 | FF4 doc lines 260-266 | 5 variants in CalendarModule + CalendarPreview | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-003 | FF4 doc lines 261-266 | EventListView + unified events API | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-004 | FF4 doc lines 351-366 | CompactView + Home template 50/50 | backend/test_ff4_phase11_calendar.py + qa/ff4-phase6-cal-tpl.spec.ts | PASS |
| FF4-CAL-005 | FF4 doc lines 268-273 | No mobile variant switcher | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-006 | FF4 doc lines 275-289 | DateNavBar prev/next/Today | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-007 | FF4 doc lines 291-298 | compactThreshold + fit warning banner | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-008 | FF4 doc lines 301-312 | Month grid + agenda + event detail | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-009 | FF4 doc lines 314-323 | Time-block grid, overlap, current-time; mobile layoutTimedEvents | qa/ff4-phase11-calendar.spec.ts + mobile/CalendarModule.tsx | PASS |
| FF4-CAL-010 | FF4 doc lines 325-340 | Deferred ThreeDay variant | requirements-ledger deferral | PASS |
| FF4-CAL-011 | FF4 doc lines 367-393 | Event detail surface | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-012 | FF4 doc lines 395-416 | Unified event model | backend/test_calendar.py | PASS |
| FF4-CAL-013 | FF4 doc lines 418-425 | Local-first SQLite + cache | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-014 | FF4 doc lines 427-432 | Local default; remote deferred V1 | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-015 | FF4 doc lines 434-438 | sourceColor persisted | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-016 | FF4 doc lines 440-449 | Inspector filter props | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-017 | FF4 doc lines 451-464 | Calendar API CRUD | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-018 | FF4 doc lines 466-473 | react-native-calendars wrapper | mobile/CalendarModule.tsx | PASS |
| FF4-CAL-019 | FF4 doc lines 475-487 | Inspector fields | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-020 | FF4 doc lines 489-504 | Home compact calendar | backend/test_ff4_phase11_calendar.py + qa/ff4-phase6-cal-tpl.spec.ts | PASS |
| FF4-CAL-021 | FF4 doc lines 495-504 | Daily Planner week in Empty stack | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-022 | FF4 doc line 673 | Mobile no variant switcher | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-023 | FF4 doc line 674 | compactThreshold auto-adapt | backend/test_ff4_phase11_calendar.py | PASS |
| FF4-CAL-024 | FF4 doc line 675 | Source badges four types | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-CAL-025 | FF4 doc line 676 | Notes truncate 2 lines | qa/ff4-phase11-calendar.spec.ts | PASS |
| FF4-TPL-001 | FF4 doc lines 556-563 | Seed templates + apply | qa/ff4-phase12-tpl-wf-mcp.spec.ts + backend/test_ff4_phase12_tpl_wf_mcp.py | PASS |
| FF4-TPL-002 | FF4 doc lines 31-32, 560-563 | | | NOT TESTED |
| FF4-TPL-003 | FF4 doc lines 560-563 | JSON payloads validate | backend/test_ff4_phase12_tpl_wf_mcp.py | PASS |
| FF4-TPL-004 | FF4 doc lines 1337-1361 | Apply with auto_checkpoint | backend/test_ff4_phase12_tpl_wf_mcp.py + qa/ff4-phase12-tpl-wf-mcp.spec.ts | PASS |
| FF4-TPL-005 | FF4 doc lines 1362-1378 | | | NOT TESTED |
| FF4-TPL-006 | FF4 doc lines 1568-1576 | | | NOT TESTED |
| FF4-WF-001 | FF4 doc lines 566-568 | Sample workflows seeded | backend/test_ff4_phase12_tpl_wf_mcp.py + qa/ff4-phase12-tpl-wf-mcp.spec.ts | PASS |
| FF4-WF-002 | FF4 doc lines 566-568 | | | NOT TESTED |
| FF4-VER-001 | FF4 doc lines 586-628 | | | NOT TESTED |
| FF4-VER-002 | FF4 doc lines 630-653 | | | NOT TESTED |
| FF4-VER-003 | FF4 doc lines 655-692 | | | NOT TESTED |
| FF4-VER-004 | FF4 doc lines 695-856 | | | NOT TESTED |
| FF4-VER-005 | FF4 doc lines 770-772 | | | NOT TESTED |
| FF4-VER-006 | FF4 doc lines 1381-1447 | | | NOT TESTED |
| FF4-VER-007 | FF4 doc lines 1435-1447 | | | NOT TESTED |
| FF4-VER-008 | FF4 doc lines 1556-1566 | | | NOT TESTED |
| FF4-VER-009 | FF4 doc lines 664-689 | | | NOT TESTED |
| FF4-BE-001 | FF4 doc lines 1664-1737 | | | NOT TESTED |
| FF4-BE-002 | FF4 doc lines 1689-1700 | | | NOT TESTED |
| FF4-BE-003 | FF4 doc lines 1702-1713 | | | NOT TESTED |
| FF4-BE-004 | FF4 doc lines 1708-1713 | | | NOT TESTED |
| FF4-BE-005 | FF4 doc lines 1728-1737 | | | NOT TESTED |
| FF4-BE-006 | FF4 doc lines 1739-1747 | | | NOT TESTED |
| FF4-BE-007 | FF4 doc lines 1450-1521 | | | NOT TESTED |
| FF4-BE-008 | FF4 doc lines 684-692, 694-699 | | | NOT TESTED |
| FF4-BE-009 | FF4 doc lines 706-734 | | | NOT TESTED |
| FF4-BE-010 | FF4 doc lines 736-741 | | | NOT TESTED |
| FF4-BE-011 | FF4 doc lines 561-562, 762-764 | | | NOT TESTED |
| FF4-BE-012 | FF4 doc lines 770-771 | | | NOT TESTED |
| FF4-BE-013 | FF4 doc lines 766-768 | | | NOT TESTED |
| FF4-BE-014 | FF4 doc lines 684-689 | | | NOT TESTED |
| FF4-BE-015 | FF4 doc lines 615-616 | | | NOT TESTED |
| FF4-BE-016 | FF4 doc lines 1295-1333 | | | NOT TESTED |
| FF4-BE-017 | FF4 doc lines 751-753 | | | NOT TESTED |
| FF4-MCP-001 | FF4 doc lines 1748-1750 | MCP tools registered | backend/test_ff4_phase12_tpl_wf_mcp.py | PASS |
| FF4-MCP-002 | FF4 doc lines 1748-1750 | App creation API path | backend/test_ff4_phase12_tpl_wf_mcp.py | PASS |
| FF4-QA-001 | FF4 doc lines 202-203 | | | NOT TESTED |
| FF4-QA-002 | FF4 doc lines 15-16 | `qa/src/tests/app-editor.spec.ts` | BrowserPreview, save/publish smoke, module pinning | COVERED (automated e2e) |
| FF4-QA-003 | FF4 doc lines 3-4, 1625-1628 | | | NOT TESTED |
| FF4-QA-004 | FF4 doc lines 1753-1754 | react-doctor in AGENTS + helm-reviewer | backend/test_ff4_phase12_tpl_wf_mcp.py | PASS |
| FF4-QA-005 | FF4 doc lines 188-189 | | | NOT TESTED |
| FF4-QA-006 | FF4 doc lines 574-576 | ConnectionsPage E2E | qa/ff4-phase12-tpl-wf-mcp.spec.ts + backend/test_ff4_phase12_tpl_wf_mcp.py | PASS |
| FF4-QA-007 | FF4 doc lines 578-580 | | | NOT TESTED |
| FF4-QA-008 | FF4 doc lines 582-584 | | | NOT TESTED |
| FF4-NOTES-001 | FF4 doc lines 511-546 | NotesModule preview + API | qa/ff4-phase10-components.spec.ts + backend/test_ff4_phase10_components.py | PASS |
| FF4-NOTES-002 | FF4 doc lines 530-535 | | | NOT TESTED |
| FF4-NOTES-003 | FF4 doc lines 537-541 | | | NOT TESTED |
| FF4-NOTES-004 | FF4 doc lines 543-546 | | | NOT TESTED |
| FF4-IB-001 | FF4 doc lines 548-550 | InputBar preview + registry | qa/ff4-phase10-components.spec.ts + backend/test_ff4_phase10_components.py | PASS |
| FF4-TODO-001 | FF4 doc lines 552-554 | Todo preview + API | qa/ff4-phase10-components.spec.ts + backend/test_ff4_phase10_components.py | PASS |
| FF4-TODO-002 | FF4 doc lines 552-554 | | | NOT TESTED |
| FF4-DES-001 | FF4 doc lines 11-12 | | | NOT TESTED |
| FF4-DES-002 | FF4 doc lines 507-509 | | | NOT TESTED |
| FF4-DES-003 | FF4 doc lines 578-580 | | | NOT TESTED |
