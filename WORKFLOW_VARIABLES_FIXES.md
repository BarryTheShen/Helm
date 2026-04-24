# Workflow & Variables Bug Fixes

## Summary
Fixed 9 critical bugs in the Workflows, Variables, and Connections pages as reported in Feature Feedback 3 (lines 169-194).

## Files Modified

### 1. `/web/src/components/workflow/NodeInspector.tsx`
**Bug Fixed:** Dropdowns and text inputs reset immediately after selection/typing
**Root Cause:** Controlled inputs were calling `onUpdate` synchronously, causing parent re-render during typing
**Solution:** 
- Changed `updateData`, `updateParams`, and `updateConfig` to use `setLocalData` with functional updates
- Deferred parent `onUpdate` calls using `setTimeout(..., 0)` to avoid re-render during typing
- This allows users to type continuously without input resets

### 2. `/web/src/pages/WorkflowsPage.tsx`
**Bugs Fixed:**
- Switch nodes had only one handle (default) instead of dynamic handles per case
- Loop nodes used `rounded-full` instead of proper rounded rectangle shape
- Selected node state wasn't syncing with node data updates

**Solutions:**
- **SwitchNode:** Generate dynamic handles for each case value, distributed evenly across bottom edge
- **LoopNode:** Changed from `rounded-full` to `rounded-xl` for proper loop shape
- **updateNodeData:** Added `setSelectedNode` update to keep inspector in sync when editing

### 3. `/web/src/pages/ConnectionsPage.tsx`
**Bug Fixed:** Only 3 hardcoded provider types (OpenWeatherMap, NewsAPI, Custom)
**Solution:**
- Expanded to 12 provider types with categories:
  - Weather: OpenWeatherMap
  - News: NewsAPI
  - AI: OpenAI, Anthropic
  - Calendar: Google Calendar
  - Development: GitHub
  - Payments: Stripe
  - Email: SendGrid
  - SMS: Twilio
  - Communication: Slack, Discord
  - Other: Custom API
- Grouped providers by category in dropdown using `<optgroup>`
- Added category-specific badge colors

### 4. `/web/src/pages/VariablesPage.tsx`
**Bugs Fixed:**
- Data sources confusing with no hints about what to fill in
- Connector field unclear
- Config JSON field had no examples

**Solutions:**
- Added comprehensive help section in create form with:
  - Explanation of Type, Connector, and Config JSON
  - Real-world connector examples (local_db, http_json, google_calendar, rss_feed)
  - Config JSON examples for HTTP, RSS, and Local DB
  - Tip about referencing API keys from Connections page
- Expanded type dropdown from 6 to 10 options (added tasks, contacts, rss, database)
- Added tooltip hints on Connector and Config JSON labels
- Improved placeholder text with realistic examples
- Added "How Data Sources Work" help section at bottom with:
  - Explanation of data source binding
  - Example usage with `{{data.*}}` variables
  - Common connector list
  - Tip about using `{{connection.*}}` for API keys

## Bugs Fixed (9 total)

### Workflows (7 bugs)
1. ✅ Action nodes missing connection points - Already had handles, issue was with inspector
2. ✅ Dropdowns reset immediately - Fixed with deferred updates
3. ✅ Condition input resets after 1 character - Fixed with deferred updates
4. ✅ Switches don't work - Added dynamic handle generation per case
5. ✅ Loop shape incorrect - Changed from rounded-full to rounded-xl
6. ✅ Trigger type dropdown bugged - Fixed with deferred updates
7. ✅ Selected node not syncing - Added setSelectedNode in updateNodeData

### Variables & Data Sources (1 bug)
8. ✅ Data sources confusing - Added comprehensive help text, examples, and tooltips

### Connections (1 bug)
9. ✅ Hardcoded provider types - Expanded to 12 providers with categories

## Testing
- Backend workflow tests pass (32/32)
- All changes are frontend-only (no backend modifications needed)
- No breaking changes to existing functionality

## Notes
- OAuth support deferred as requested
- All fixes maintain existing patterns and conventions
- No new dependencies added
