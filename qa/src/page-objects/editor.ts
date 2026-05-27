import { expect } from '@playwright/test';

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
  toggleSwitch: '[data-testid="toggle-switch"]',
  addRowByText: 'button:text-is("Add Row")',
  dividerColorLabel: 'text=Divider Color',
  viewTypeLabel: 'text=View Type',
  rowInTree: '[data-testid="row-in-tree"]',
};

/** Wait until module editor is ready to save */
export async function waitForEditorReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await page.locator(EditorPage.btnSave).waitFor({ state: 'visible', timeout: 15000 });
  await page.locator(EditorPage.btnSave).waitFor({ state: 'attached' });
  for (let i = 0; i < 30; i++) {
    if (await page.locator(EditorPage.btnSave).isEnabled()) return;
    await page.waitForTimeout(300);
  }
}

/** Add a 1-column row via structure tree + button (works from 0-row empty modules). */
export async function addRowViaStructureTree(page: import('@playwright/test').Page) {
  const rows = page.locator(EditorPage.rowInTree);
  const addRowBtn = page.locator(EditorPage.btnAddRow);
  await addRowBtn.waitFor({ state: 'visible', timeout: 10000 });
  const rowsBefore = await rows.count();
  await addRowBtn.click();
  await expect.poll(async () => rows.count(), { timeout: 15000 }).toBeGreaterThan(rowsBefore);
  await expect.poll(async () => page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: { getState: () => { rows: Array<{ cells: Array<{ content: unknown | null }> }> } } }).__editorStore;
    if (!store) return 0;
    return store.getState().rows.reduce(
      (count, row) => count + row.cells.filter((cell) => !cell.content).length,
      0,
    );
  }), { timeout: 10000 }).toBeGreaterThan(0);
}

/** Click save and wait for legacy SDUI POST (accepts empty-screen confirm) */
export async function saveModuleAndWait(page: import('@playwright/test').Page) {
  page.once('dialog', (d) => d.accept());
  const saveResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/sdui/') && resp.request().method() === 'POST' && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.locator(EditorPage.btnSave).click();
  await saveResponse;
}
