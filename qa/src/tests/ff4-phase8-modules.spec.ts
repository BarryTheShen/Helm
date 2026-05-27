import { test, expect } from '../fixtures';
import { EditorPage, waitForEditorReady, addRowViaStructureTree, saveModuleAndWait } from '../page-objects/editor';
import { addComponentToFirstCell } from '../editor-helpers';

test.describe('FF4 Phase 8 — module editor, versioning, rows', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await waitForEditorReady(page);
  });

  test('FF4-MOD-009: top bar shows FF4 labels and no publish/approve controls', async ({ page }) => {
    await expect(page.locator('[data-testid="module-selector"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Checkpoint' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview in Web Admin' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Publish to Mobile/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Approve$/i })).toHaveCount(0);
  });

  test('FF4-MOD-010: autosave shows Saving then Saved after edit', async ({ page }) => {
    await addRowViaStructureTree(page);
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/sdui/') && resp.request().method() === 'POST' && resp.status() === 200,
      { timeout: 15000 },
    );
    await expect(page.locator('[data-testid="autosave-status-saved"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="autosave-status-saved"]')).toContainText(/Saved/i);
  });

  test('FF4-MOD-006: right-click module shows functional context menu', async ({ page }) => {
    const createResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/sdui/modules')
        && resp.request().method() === 'POST'
        && resp.status() === 201,
      { timeout: 15000 },
    );
    await page.locator('[data-testid="btn-new-module"]').click();
    const created = await createResponse;
    const body = await created.json();
    await waitForEditorReady(page);

    const moduleRow = page.locator('aside span.truncate.font-medium').filter({
      hasText: new RegExp(body.name || 'Module', 'i'),
    }).first();
    await moduleRow.click({ button: 'right' });
    const menu = page.locator('[data-testid="module-context-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Rename')).toBeVisible();
    await expect(menu.getByText('Duplicate')).toBeVisible();
    await expect(menu.getByText('Delete')).toBeVisible();
  });

  test('FF4-MOD-016: delete row with content requires confirmation', async ({ page }) => {
    await addComponentToFirstCell(page, 'Text');
    const row = page.locator('[data-testid="editor-canvas"] .group.rounded-lg').first();
    await row.click({ button: 'right' });
    const menu = page.locator('[data-testid="row-context-menu"]');
    await expect(menu).toBeVisible();

    let dialogShown = false;
    page.once('dialog', (dialog) => {
      dialogShown = true;
      void dialog.dismiss();
    });
    await menu.getByRole('menuitem', { name: 'Delete Row' }).click();
    await page.waitForTimeout(300);
    expect(dialogShown).toBe(true);
  });

  test('FF4-MOD-012: preview modal renders module draft with inline validation area', async ({ page }) => {
    await page.locator('[data-testid="btn-preview-web"]').click();
    await expect(page.locator('[data-testid="module-editor-preview"]')).toBeVisible({ timeout: 10000 });
  });

  test('FF4-MOD-011: applying local template auto-creates checkpoint', async ({ page }) => {
    const checkpointPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/checkpoints')
        && resp.request().method() === 'POST'
        && resp.status() < 400,
      { timeout: 20000 },
    );

    page.once('dialog', (d) => d.accept());
    await page.locator('button').filter({ hasText: /^Templates$/ }).last().click();
    await page.getByText('Apply module').first().click();
    await checkpointPromise;
  });

  test('FF4-VER-002/003: checkpoint uses timestamp naming; history modal opens', async ({ page }) => {
    page.once('dialog', (d) => d.accept());
    const checkpointResponse = page.waitForResponse(
      (resp) => resp.url().includes('/checkpoints') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );
    await saveModuleAndWait(page);
    await page.locator('[data-testid="btn-checkpoint"]').click();
    const resp = await checkpointResponse;
    const body = await resp.json();
    expect(body.default_timestamp_name || body.display_name).toBeTruthy();

    await page.locator('[data-testid="btn-version-history"]').click();
    const modal = page.locator('[data-testid="version-history-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Version History/i)).toBeVisible();
  });

  test('FF4-VER-009: compare versions control visible when history has entries', async ({ page }) => {
    await page.locator('[data-testid="btn-version-history"]').click();
    const modal = page.locator('[data-testid="version-history-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });
    const versionCount = await modal.locator('[class*="border rounded-lg"]').count();
    if (versionCount >= 2) {
      await expect(modal.getByRole('button', { name: 'Compare' })).toBeVisible();
    }
  });

  test('FF4-ROW-001: row drag handle is visible on the left of the row', async ({ page }) => {
    await addRowViaStructureTree(page);
    const handle = page.locator('[data-testid^="row-drag-handle"]').first();
    await expect(handle).toBeVisible();
    const row = page.locator('[data-testid="editor-canvas"] .group.rounded-lg').first();
    const handleBox = await handle.boundingBox();
    const rowBox = await row.boundingBox();
    expect(handleBox).toBeTruthy();
    expect(rowBox).toBeTruthy();
    if (handleBox && rowBox) {
      expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(rowBox.x + 4);
    }
  });

  test('FF4-ROW-006: Add Cell disabled when minimum width would be violated', async ({ page }) => {
    const rowInTree = page.locator(EditorPage.rowInTree).first();
    await rowInTree.click();
    await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

    const addCellBtn = page.locator('[data-testid="btn-add-cell"]');
    let clicks = 0;
    while (await addCellBtn.isEnabled() && clicks < 20) {
      await addCellBtn.click();
      clicks += 1;
      await page.waitForTimeout(100);
    }
    await expect(addCellBtn).toBeDisabled();
    await expect(page.locator(EditorPage.propertyInspector)).toContainText(/minimum|too narrow/i);
  });

  test('FF4-CELL-003: seventh cell allowed when width rules permit', async ({ page }) => {
    const rowInTree = page.locator(EditorPage.rowInTree).first();
    await rowInTree.click();
    const addCellBtn = page.locator('[data-testid="btn-add-cell"]');
    let count = await page.locator(EditorPage.propertyInspector).locator('span.font-medium.w-8').textContent();
    let cells = Number.parseInt(count?.trim() || '1', 10);
    while (cells < 7 && (await addCellBtn.isEnabled())) {
      await addCellBtn.click();
      await page.waitForTimeout(100);
      count = await page.locator(EditorPage.propertyInspector).locator('span.font-medium.w-8').textContent();
      cells = Number.parseInt(count?.trim() || '1', 10);
    }
    expect(cells).toBeGreaterThanOrEqual(7);
  });

  test('FF4-ROW-013/014: row inspector has no padding or background controls', async ({ page }) => {
    await page.locator(EditorPage.rowInTree).first().click();
    const inspector = page.locator(EditorPage.propertyInspector);
    await expect(inspector.getByText(/^Padding$/i)).toHaveCount(0);
    await expect(inspector.getByText(/^Gap$/i)).toHaveCount(0);
    await expect(inspector.getByText(/^Background$/i)).toHaveCount(0);
  });

  test('FF4-ROW-011: invalid fixed widths show layout validation banner', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as unknown as { __editorStore?: { getState: () => { rows: unknown[]; loadScreen: (s: unknown) => void; getScreen: () => unknown } } }).__editorStore;
      if (!store) return;
      const state = store.getState();
      const screen = state.getScreen() as { rows: Array<{ id: string; cells: Array<{ id: string; width: string; content: null }> }> };
      if (!screen.rows[0]) return;
      screen.rows[0].cells = [
        { id: 'c1', width: '60%', content: null },
        { id: 'c2', width: '60%', content: null },
      ];
      state.loadScreen(screen);
    });
    await expect(page.locator('[data-testid="row-layout-validation-banner"]')).toBeVisible({ timeout: 10000 });
  });

  test('FF4-ROW-015: row height resize stops at minimum boundary', async ({ page }) => {
    await addRowViaStructureTree(page);
    const rowCanvas = page.locator('[data-testid="editor-canvas"] .group.rounded-lg').last();
    await rowCanvas.click();
    await page.locator(EditorPage.rowInTree).last().click();

    const heightInput = page.locator(EditorPage.propertyInspector).locator('input[type="number"]').first();
    await heightInput.fill('160');
    await heightInput.press('Tab');
    await page.waitForTimeout(300);

    const handle = rowCanvas.locator('[data-testid="row-height-resize-handle"]');
    await expect(handle).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    const handleBox = await handle.boundingBox();
    expect(handleBox).toBeTruthy();

    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 500, { steps: 25 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const committedHeight = await page.evaluate(() => {
      const store = (window as unknown as { __editorStore?: { getState: () => { rows: Array<{ height?: number | string }> } } }).__editorStore;
      const rows = store?.getState().rows ?? [];
      const lastRow = rows[rows.length - 1];
      return typeof lastRow?.height === 'number' ? lastRow.height : null;
    });

    expect(committedHeight).toBeGreaterThanOrEqual(48);
    expect(committedHeight).toBeLessThanOrEqual(52);
  });
});
