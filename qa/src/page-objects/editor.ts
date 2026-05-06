export const EditorPage = {
  toolbar: '[data-testid="toolbar"]',
  btnSave: '[data-testid="btn-save"]',
  btnPushLive: '[data-testid="btn-push-live"]',
  btnUndo: '[data-testid="btn-undo"]',
  btnRedo: '[data-testid="btn-redo"]',
  btnDeleteModule: '[data-testid="btn-delete-module"]',
  btnDevicePicker: '[data-testid="btn-device-picker"]',
  structureTree: '[data-testid="structure-tree"]',
  btnAddRow: '[data-testid="btn-add-row"]',
  canvas: '[data-testid="editor-canvas"]',
  propertyInspector: '[data-testid="property-inspector"]',
  selectVariant: '[data-testid="select-variant"]',
  toggleShowDivider: '[data-testid="toggle-show-divider"]',
  btnTemplates: 'button:has-text("Templates")',
  btnSaveAsTemplate: 'button:has-text("Save as Template")',
  btnPreviewApp: 'button:has-text("Preview App")',
  unknownLabel: 'text=Unknown',
  // Added: row item in structure tree (matches "Row 1", "Row 2", etc.)
  rowInTree: '[data-testid="structure-tree"] text=/Row \\d+/',
  // Added: toggle switch button (used for Show Divider)
  toggleSwitch: 'button.relative.w-9.h-5',
  // Added: add row button (fallback text-based selector)
  addRowByText: 'button:has-text("Add Row")',
  // Added: divider color label in inspector
  dividerColorLabel: 'text=Divider Color',
  // Added: view type label in inspector
  viewTypeLabel: 'text=View Type',
};
