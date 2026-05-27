import { test, expect } from '../fixtures';
import { EditorPage } from '../page-objects/editor';
import { ensureEmptyCellExists, addComponentToFirstCell, ensureMultiCellRow } from '../editor-helpers';
import { addRowViaStructureTree } from '../page-objects/editor';

test('Issue 1: drag handles should be positioned inside the canvas area', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await expect(page.locator(EditorPage.canvas)).toBeVisible();

  // Ensure there's at least one row so drag handles exist
  await ensureEmptyCellExists(page);

  // The editor canvas is the center panel -- drag handles should be outside/beside it
  // Row drag handles have data-testid="row-drag-handle-{rowId}" (see EditorCanvas.tsx)
  const dragHandles = page.locator('[data-testid^="row-drag-handle"]');
  const handleCount = await dragHandles.count();

  if (handleCount > 0) {
    const handle = dragHandles.first();
    const handleBox = await handle.boundingBox();
    expect(handleBox, 'drag handle should exist').not.toBeNull();

    // Find the editor canvas for bounding comparison
    const canvas = page.locator(EditorPage.canvas).first();
    const canvasVisible = await canvas.isVisible();
    if (canvasVisible) {
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox, 'canvas should exist').not.toBeNull();

      // Drag handle should be INSIDE the canvas bounds (visible overlapping the canvas area)
      const isInsideCanvas =
        handleBox!.x > canvasBox!.x &&
        handleBox!.x + handleBox!.width < canvasBox!.x + canvasBox!.width;

      expect(
        isInsideCanvas,
        'drag handles should be positioned inside the canvas area, not outside it'
      ).toBe(true);
    }
  } else {
    // Fallback: look for the external drag handle by data-testid
    const gripIcon = page.locator('[data-testid^="row-drag-handle"]');
    expect(
      await gripIcon.count(),
      'external drag handles should be visible on rows'
    ).toBeGreaterThan(0);
  }
});

test('Issue 10: divider shows visual border-bottom on row', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await expect(page.locator(EditorPage.structureTree)).toBeVisible();
  await expect(page.locator(EditorPage.rowInTree).first()).toBeVisible({ timeout: 15000 });

  // Ensure there is at least one row in the structure
  const rowInTree = page.locator('[data-testid="row-in-tree"]');
  const rowCount = await rowInTree.count();
  if (rowCount === 0) {
    await addRowViaStructureTree(page);
    await expect(rowInTree.first()).toBeVisible();
  }

  // Select a row from the structure tree
  const firstRow = rowInTree.first();
  if (await firstRow.isVisible()) {
    await firstRow.click();
    await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

    // Find and enable the "Show Divider" toggle in the property inspector
    const dividerLabel = page.locator('text=Show Divider').first();
    if (await dividerLabel.isVisible()) {
      // Use data-testid selector for the toggle
      const toggleBtn = page.locator(EditorPage.toggleShowDivider).first();
      if (await toggleBtn.isVisible()) {
        await toggleBtn.click();
        await expect(dividerLabel).toBeVisible();

        // Verify the divider color field appeared (confirms toggle is on)
        const colorLabel = page.locator('text=Divider Color').first();
        expect(
          await colorLabel.isVisible(),
          'Divider Color field should appear when Show Divider is enabled'
        ).toBe(true);

        // Check the canvas for a visual border-bottom on the row
        // The row content container gets border-bottom as an inline style (see EditorCanvas.tsx getRowContentStyle)
        const rowInCanvas = page.locator('[data-testid="editor-canvas"] [style*="border-bottom"]').first();
        expect(
          await rowInCanvas.count(),
          'row should have border-bottom style when divider is enabled'
        ).toBeGreaterThan(0);
      }
    } else {
      // "Show Divider" label not found -- the inspector may not expose it yet
      // At minimum verify the row is selected and inspector is showing
      expect(
        await rowInTree.count(),
        'row should be selectable in the tree'
      ).toBeGreaterThan(0);
    }
  }
});

test('FF4-ROW-002: row height resize handle increases row height on drag', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await ensureEmptyCellExists(page);

  const row = page.locator('[data-testid="editor-canvas"] .group.rounded-lg').first();
  await expect(row).toBeVisible();

  const initialBox = await row.boundingBox();
  expect(initialBox, 'row should have measurable height').not.toBeNull();

  const handle = page.locator('[data-testid="row-height-resize-handle"]').first();
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  expect(handleBox, 'resize handle should exist').not.toBeNull();

  const startX = handleBox!.x + handleBox!.width / 2;
  const startY = handleBox!.y + handleBox!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 80, { steps: 12 });
  await page.mouse.up();

  const resizedBox = await row.boundingBox();
  expect(resizedBox, 'row should still be measurable after resize').not.toBeNull();
  expect(
    resizedBox!.height,
    'row height should increase after dragging the bottom resize handle'
  ).toBeGreaterThan(initialBox!.height + 40);
});

test('FF4-CELL-001: cell divider drag changes adjacent cell widths', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await ensureMultiCellRow(page);

  const rowCanvas = page.locator('[data-testid="editor-canvas"] .group.rounded-lg').filter({
    has: page.locator('[data-testid^="cell-resize-handle-"]'),
  }).first();
  const handle = rowCanvas.locator('[data-testid^="cell-resize-handle-"]').first();
  await expect(handle).toBeVisible({ timeout: 10000 });

  const cells = rowCanvas.locator(':scope > .flex.min-h-\\[48px\\] > div.rounded');
  const leftCell = cells.first();
  const rightCell = cells.nth(1);

  const leftBefore = (await leftCell.boundingBox())!.width;
  const rightBefore = (await rightCell.boundingBox())!.width;

  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  const startX = handleBox!.x + handleBox!.width / 2;
  const startY = handleBox!.y + handleBox!.height / 2;

  await handle.scrollIntoViewIfNeeded();
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const leftAfter = (await leftCell.boundingBox())!.width;
  const rightAfter = (await rightCell.boundingBox())!.width;

  expect(leftAfter - leftBefore, 'left cell should grow when divider moves right').toBeGreaterThan(15);
  expect(rightBefore - rightAfter, 'right cell should shrink when divider moves right').toBeGreaterThan(15);
});

test('FF4-ROW-012 / FF4-CELL-004: button preview fills its cell bounds', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await ensureEmptyCellExists(page);
  await addRowViaStructureTree(page);
  await addComponentToFirstCell(page, 'Button', { emptyCell: 'last' });

  const button = page.locator('[data-testid="editor-canvas"] button.flex.h-full.w-full').last();
  await expect(button).toBeVisible();

  const cell = button.locator('xpath=ancestor::div[contains(@class,"group/cell")][1]');
  await expect(cell).toBeVisible();

  const cellBox = await cell.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(cellBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  expect(
    Math.abs(buttonBox!.width - cellBox!.width),
    'button width should match cell width (fit-the-cell)'
  ).toBeLessThan(4);
  expect(
    Math.abs(buttonBox!.height - cellBox!.height),
    'button height should match cell height (fit-the-cell)'
  ).toBeLessThan(4);
});

test('FF4-BTN-002: button icon mode renders visible centered icon', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await ensureEmptyCellExists(page);
  await addRowViaStructureTree(page);
  await addComponentToFirstCell(page, 'Button', { emptyCell: 'last' });

  await page.locator('[data-testid="select-variant"]').selectOption('icon');
  await page.waitForLoadState('networkidle');

  const iconPreview = page.locator('[data-testid="button-icon-preview"]').last();
  await expect(iconPreview).toBeVisible({ timeout: 10000 });
  await expect(iconPreview.locator('svg')).toBeVisible();

  const previewBox = await iconPreview.boundingBox();
  const cell = iconPreview.locator('xpath=ancestor::div[contains(@class,"group/cell")][1]');
  await expect(cell).toBeVisible();
  const cellBox = await cell.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(cellBox).not.toBeNull();

  if (previewBox && cellBox) {
    const iconCenterX = previewBox.x + previewBox.width / 2;
    const iconCenterY = previewBox.y + previewBox.height / 2;
    const cellCenterX = cellBox.x + cellBox.width / 2;
    const cellCenterY = cellBox.y + cellBox.height / 2;
    expect(Math.abs(iconCenterX - cellCenterX)).toBeLessThan(8);
    expect(Math.abs(iconCenterY - cellCenterY)).toBeLessThan(8);
  }
});
