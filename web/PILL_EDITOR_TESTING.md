# Variable Pill UI Implementation - Testing Guide

## Installation Required

Before testing, install the TipTap dependencies:

```bash
cd /home/barry/Nextcloud/vc_projects/Helm/web
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder
```

## Files Created/Modified

### New Files:
1. `/web/src/editor/VariablePillExtension.ts` - Custom TipTap node for variable pills
2. `/web/src/editor/VariablePillNodeView.tsx` - React component rendering the pill UI
3. `/web/src/editor/PillEditor.tsx` - Main editor component with @ trigger support
4. `/web/src/editor/pill-editor.css` - Styles for the pill editor

### Modified Files:
1. `/web/src/editor/VariableInput.tsx` - Now uses PillEditor instead of plain input

## Features Implemented

### 1. Variable Pill Display
- Pills render as rounded boxes with namespace icons
- Format: `[👤 user.name]` instead of raw `{{user.name}}`
- Color-coded: blue background with darker blue text
- Non-editable inline atoms

### 2. @ Trigger
- Type `@` to open the variable picker
- Filter variables by typing after `@`
- Select from picker to insert pill
- ESC to close picker

### 3. Pill Deletion
- **Backspace**: Deletes entire pill when cursor is after it
- **Delete**: Deletes entire pill when cursor is before it
- No character-by-character editing of pills

### 4. Serialization
- Editor content serializes to `{{namespace.key}}` format
- Backend receives the same format as before
- Pills parse from existing `{{variable}}` strings on load

### 5. Applied To
- ✅ Text atomic component (via VariableInput)
- ✅ Markdown atomic component (via VariableInput with multiline)
- ✅ Button label (via VariableInput)
- ✅ InputBar default value (via VariableInput)
- ✅ All action fields that use VariableInput

## Testing Instructions

### Test 1: Basic Pill Insertion
1. Start the web admin: `cd web && npm run dev`
2. Navigate to Editor page
3. Add a Text component
4. In the "Text" property field, type `@`
5. **Expected**: Variable picker opens
6. Select "user.username"
7. **Expected**: Pill appears as `[👤 user.username]` (blue rounded box)

### Test 2: Pill Deletion
1. With a pill in the editor, place cursor after the pill
2. Press Backspace
3. **Expected**: Entire pill deletes, not just one character
4. Insert another pill, place cursor before it
5. Press Delete
6. **Expected**: Entire pill deletes

### Test 3: Cannot Edit Pill Characters
1. Insert a pill
2. Try to click inside the pill
3. **Expected**: Cursor cannot enter the pill
4. Try to select part of the pill
5. **Expected**: Entire pill selects or nothing selects

### Test 4: Mixed Content
1. Type: "Hello @" → select user.name → " your email is @" → select user.email
2. **Expected**: "Hello [👤 user.name] your email is [👤 user.email]"
3. Save the component
4. **Expected**: Backend receives `"Hello {{user.name}} your email is {{user.email}}"`

### Test 5: Multiline (Markdown/Textarea)
1. Add a Markdown component
2. In the "Content" field (multiline), type multiple lines with pills
3. **Expected**: Pills work across multiple lines
4. Press Enter to create new lines
5. **Expected**: Line breaks preserved

### Test 6: Button Label
1. Add a Button component
2. In the "Label" field, type "Welcome @" → select user.username
3. **Expected**: Pill appears in button label field
4. Preview the button
5. **Expected**: Button shows the variable reference

### Test 7: InputBar Default Value
1. Add an InputBar component
2. In the "Default Value" field, insert pills
3. **Expected**: Pills render correctly
4. Save and preview
5. **Expected**: Default value contains variable references

### Test 8: Existing Variables Load
1. Create a component with text: `{{user.name}}`
2. Save and reload the editor
3. **Expected**: Text loads as a pill, not raw text

### Test 9: Namespace Icons
Test that different namespaces show different icons:
- `user.*` → 👤
- `self.*` → 🔄
- `custom.*` → ⚙️
- `env.*` → 🌍
- `component.*` → 🧩
- `connection.*` → 🔗
- `data.*` → 📊

### Test 10: Type Safety (Future Enhancement)
Currently, type checking is not enforced at write-time. This would require:
1. Fetching variable type metadata from backend
2. Validating field type vs variable type
3. Showing warnings for type mismatches

## Known Limitations

1. **Type checking**: Not yet implemented. Variables are inserted without type validation.
2. **Autocomplete**: Filter works but doesn't highlight matches
3. **Keyboard navigation**: Arrow keys in picker not implemented (click-only)
4. **Copy/paste**: Pills may paste as plain text in some contexts

## Troubleshooting

### Pills don't appear
- Check browser console for TipTap import errors
- Verify npm install completed successfully
- Check that pill-editor.css is loaded

### @ trigger doesn't work
- Check that PillEditor is receiving focus
- Verify VariablePicker is rendering (check React DevTools)
- Check console for JavaScript errors

### Pills show as raw text
- Verify VariablePillExtension is registered in editor extensions
- Check that NodeViewRenderer is working
- Inspect DOM to see if `data-type="variable-pill"` attribute exists

### Serialization issues
- Check serializeEditorContent function logic
- Verify parseValueToPillsAndText correctly parses `{{}}` format
- Test with simple cases first (single variable)

## Architecture Notes

### Why TipTap?
- Mature rich text editor with React support
- Custom node extensions for atomic elements (pills)
- Built-in keyboard shortcuts and selection handling
- ProseMirror foundation (battle-tested)

### Data Flow
1. User types `@` → PillEditor opens VariablePicker
2. User selects variable → PillEditor inserts VariablePill node
3. VariablePill renders via VariablePillNodeView (React component)
4. On change → serializeEditorContent converts to `{{namespace.key}}`
5. Parent component receives serialized string
6. Backend processes `{{}}` format as before (no changes needed)

### Backward Compatibility
- Existing `{{variable}}` strings parse into pills on load
- Serialization outputs same format backend expects
- No backend changes required
- Old plain-text inputs still work (graceful degradation)
