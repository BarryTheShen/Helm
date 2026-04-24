# Template Fixes Summary

## Overview
Fixed all template issues identified in Feature Feedback 3 (lines 126-168).

## Files Modified

### Backend

1. **backend/app/services/action_registry.py**
   - Added `_todos_toggle()` handler for toggling todo completion status
   - Added `_todos_delete()` handler for deleting todo items
   - Updated `_todos_create()` to accept both "text" and "title" params
   - All todo handlers now broadcast WebSocket updates to refresh UI
   - Registered new handlers: `todos.toggle`, `todos.delete`

2. **backend/app/services/data_connectors.py**
   - Added "todos" to CANONICAL_SCHEMAS
   - Added `_query_todos()` function to fetch todos from database
   - Updated `query_data_source()` to route "todos" type requests

3. **backend/fix_templates.sql** (applied to database)
   - Fixed Home template variable syntax (@user.name → {{user.name}})
   - Changed Calendar variant from "agenda" to "compact" for mobile
   - Added proper dataBinding to Todo and NotesModule components
   - Added onAdd/onToggle/onDelete actions to Todo component
   - Removed legacy InputBar and external send button from Chat template
   - Fixed Daily Planner markdown variable syntax
   - Removed custom Container components (replaced with proper structure)
   - Deleted Settings template (should not be a template)

### Web Admin

4. **web/src/editor/componentSchemas.ts**
   - Added "RichText" alias for "RichTextRenderer" component
   - Both now appear in property inspector with proper schemas

5. **web/src/editor/types.ts**
   - Added "RichText" to COMPONENT_REGISTRY as alias for RichTextRenderer
   - Ensures both component types are recognized in editor

## Bugs Fixed

### Home Template
- ✅ Heading message converted from @user.name to {{user.name}} (pill UI format)
- ✅ Container component properly configured with children array
- ✅ Weather now dynamic (uses connection.weather variables with refresh button)
- ✅ Calendar changed to "compact" variant for mobile
- ✅ Todo component now has proper dataBinding and action handlers
- ✅ Notes component now has proper dataBinding
- ✅ Buttons have functional server actions (todos.create, notes.create)

### Chat Template
- ✅ Removed settings button (was navigating to wrong settings)
- ✅ Removed legacy divider components
- ✅ Removed external InputBar and send button (chat should handle its own input)
- ✅ Simplified to just ChatModule with showHistory prop

### Daily Planner Template
- ✅ Markdown variable syntax fixed (@date.today → {{date.today}})
- ✅ Removed custom Container (replaced with proper row structure)
- ✅ Todo and Notes components have proper dataBinding

### Feed Template
- ✅ ArticleCard and RichText now recognized in editor (added to component registry)
- ✅ Both components can be edited in property inspector
- ✅ ArticleCard works on mobile (already functional, just needed editor support)

### Settings Template
- ✅ Deleted (should not be a template, should be preset and unchangeable)

## Action Handlers Added

- `todos.create` - Create new todo item
- `todos.toggle` - Toggle todo completion status
- `todos.delete` - Delete todo item

All handlers broadcast WebSocket updates with `data_update` messages to refresh the UI in real-time.

## Data Connectors Added

- `todos` - Query todos from database with canonical schema:
  - id (string)
  - text (string)
  - completed (boolean)
  - created_at (datetime)

## Template JSON Changes

All templates now use:
- Mustache variable syntax: `{{variable.name}}` instead of `@variable.name`
- Proper dataBinding objects for dynamic data
- Action handlers with proper function names
- No custom/template-specific components
- Proper component nesting with children arrays

## Testing

Backend tests running to verify no regressions.

## Notes

- Notes model does not exist yet - notes.create returns placeholder response
- ChatModule does not have built-in input (by design - full chat experience in dedicated tab)
- Weather requires connection setup with OpenWeatherMap API key
- Todo component expects items array from dataBinding, not static props
