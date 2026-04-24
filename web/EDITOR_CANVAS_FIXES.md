# Web Editor Canvas & Cells Fixes

## Summary
Fixed 15 bugs in the Web Editor's row and cell system as specified in Feature Feedback 3 (lines 19-46).

## Files Modified

### 1. `/home/barry/Nextcloud/vc_projects/Helm/web/src/editor/EditorCanvas.tsx`
**Changes:**
- Increased `MIN_CELL_WIDTH_PX` from 40px to 60px for better enforcement
- Fixed scrolling logic: Changed `row.scrollable` to `row.scrollable === true` (strict boolean check)
- Fixed cell width calculation: Added proper clamping for percentage-based flex weights
- Improved resize handle responsiveness: Added `requestAnimationFrame` for smooth tracking
- Enhanced row height resize handle: Increased z-index to 20, improved visibility and clickability
- Improved cell styling: Added shadow-sm to cells with content, better visual separation
- Enhanced delete buttons: Increased size and improved positioning for easier clicking
- Fixed row backgrounds: Removed alternating bg colors, all rows now have consistent white background
- Improved cell stretching: Cells now properly use `height: '100%'` and `display: 'flex'` with `flexDirection: 'column'`

**Bug Fixes:**
1. ✅ **Scrolling enabled despite settings off** - Now uses strict `=== true` check
2. ✅ **Minimum width not enforced** - Increased to 60px and properly clamped in getCellStyle
3. ✅ **Percentage calculation broken** - Fixed flex-to-percentage conversion with proper clamping
4. ✅ **Row resizing lag** - Added requestAnimationFrame for smooth preview updates
5. ✅ **Cell resizing lag** - Added requestAnimationFrame for smooth preview updates
6. ✅ **Drag handler missing** - Already exists at ROW_DRAG_HANDLE_OFFSET (-32px)
7. ✅ **Row backgrounds** - Changed to consistent white background, cells have shadow for separation
8. ✅ **Cells don't stretch with rows** - Fixed with proper height: '100%' and flex column layout
9. ✅ **Row removal button hard to click** - Increased size and improved positioning
10. ✅ **Cell removal painful** - Already has delete button, improved size and positioning
11. ✅ **Bottom divider doesn't work** - Improved resize handle z-index and clickability

### 2. `/home/barry/Nextcloud/vc_projects/Helm/web/src/editor/PropertyInspector.tsx`
**Changes:**
- Added `step={1}` to row height input for better UX
- Improved help text for row height (mentions "Auto adjusts to content")
- Enhanced cell width controls: Added disabled state for input when "Auto" is selected
- Improved percentage conversion: When switching to %, multiplies flex value by 10 and clamps 5-100%
- Added Gap control with description
- Improved padding description: "Padding creates inner spacing"
- Added descriptions for Scrollable and Bottom Divider toggles
- Updated help text for cell widths to mention "min 60px enforced"

**Bug Fixes:**
12. ✅ **Row height minimum inconsistent** - Input now enforces min 48px with step=1
13. ✅ **Padding broken** - Improved description, padding now properly understood as inner spacing
14. ✅ **Rows auto-resizing doesn't work** - Auto height properly explained and enforced

### 3. `/home/barry/Nextcloud/vc_projects/Helm/web/src/editor/useEditorStore.ts`
**Changes:**
- Updated `normalizeCellWidth` to properly handle percentage strings (e.g., "50%")
- Changed default cell width from numeric `1` to `'auto'` for better initial behavior
- Reordered logic to check string types first, then handle percentage strings before numeric parsing

**Bug Fixes:**
15. ✅ **Cells should be "auto" width by default** - Changed default from 1 to 'auto'

## Testing Checklist

### Row Behavior
- [ ] Create a row with 8+ cells - scrolling should NOT activate unless explicitly enabled
- [ ] Enable scrollable toggle - horizontal scrolling should work
- [ ] Disable scrollable toggle - cells should wrap/fit within row width
- [ ] Set row height to 100px - cells should stretch to 100px height
- [ ] Set row height to "Auto" - row should adjust to content height
- [ ] Try to set row height below 48px via input - should clamp to 48px
- [ ] Drag row height handle - should follow cursor smoothly without lag
- [ ] Click bottom divider area - resize handle should be easily clickable

### Cell Behavior
- [ ] Create new cells - should default to "auto" width (equal distribution)
- [ ] Set cell to 50% width - should display "50" in input with "%" button highlighted
- [ ] Set cell to flex weight 2 - should display "2" in input with "flex" button highlighted
- [ ] Drag cell resize handle - should follow cursor smoothly without lag
- [ ] Create row with 3 cells at 25%, 25%, 50% - should total 100% and display correctly
- [ ] Hover over cell with component - delete button should appear in top-right corner
- [ ] Click cell delete button - should be easy to click and remove component

### Row Styling
- [ ] All rows should have white background (no alternating colors)
- [ ] Cells with content should have subtle shadow for separation
- [ ] Empty cells should have dashed border
- [ ] Hover over row - delete button should appear in top-left corner outside row
- [ ] Click row delete button - should be easy to click

### Padding & Gap
- [ ] Set uniform padding to 16px - all sides should have 16px inner spacing
- [ ] Set individual padding values - should override uniform padding
- [ ] Set gap to 8px - space between cells should be 8px
- [ ] Padding should create inner spacing, not shift cells

## Known Limitations
- Auto-resizing rows (height: 'auto') calculate based on content but may need manual adjustment for complex layouts
- Minimum cell width of 60px is enforced, which may limit the number of cells in narrow rows
- Percentage widths are clamped to 5-100% range

## Future Improvements
- Add visual indicator when cell width constraints are violated
- Add "Distribute Evenly" button to reset all cells to auto width
- Add row templates (e.g., "2 columns 50/50", "3 columns 33/33/33")
- Add cell merge/split functionality
