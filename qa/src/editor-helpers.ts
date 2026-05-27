import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { EditorPage } from './page-objects/editor';

/**
 * Ensure there is at least one row with an empty cell on the canvas.
 * If no empty cells exist, clicks "Add Row" to create one.
 */
export async function ensureEmptyCellExists(page: Page) {
  const emptyCellLocator = page.locator('[data-testid="editor-canvas"] .bg-gray-50.border-dashed');
  const addRowBtn = page.locator(EditorPage.addRowByText);

  await page.waitForLoadState('networkidle');

  try {
    await expect(emptyCellLocator.first()).toBeVisible({ timeout: 10000 });
  } catch {
    const structureAddRow = page.locator(EditorPage.btnAddRow);
    if (await structureAddRow.count() > 0) {
      await structureAddRow.first().click();
    } else if (await addRowBtn.count() > 0) {
      await addRowBtn.first().click();
    }
    await expect(emptyCellLocator.first()).toBeVisible({ timeout: 10000 });
  }
}

/**
 * Add a component to an empty cell on the canvas.
 * Uses picker-scoped selectors so canvas previews never intercept clicks.
 */
export async function addComponentToFirstCell(
  page: Page,
  componentName: string,
  options?: { emptyCell?: 'first' | 'last' },
) {
  await expect(page.locator(EditorPage.canvas)).toBeVisible();

  const canvasEmptyCells = page.locator('[data-testid="editor-canvas"] .bg-gray-50.border-dashed');
  const picker = page.locator('.shadow-xl').filter({ has: page.getByText('Add Component') });
  const targetEmptyCell =
    options?.emptyCell === 'last' ? canvasEmptyCells.last() : canvasEmptyCells.first();

  await expect(async () => {
    if (await canvasEmptyCells.count() === 0) {
      const structureAddRow = page.locator(EditorPage.btnAddRow);
      if (await structureAddRow.count() > 0) {
        await structureAddRow.first().click();
      } else {
        const addRowBtn = page.locator(EditorPage.addRowByText);
        if (await addRowBtn.count() > 0) {
          await addRowBtn.first().click();
        }
      }
    }
    await expect(targetEmptyCell).toBeVisible({ timeout: 3000 });
    await targetEmptyCell.click();
    await expect(picker).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 15000 });

  const spacedName = componentName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  const displayName = spacedName !== componentName ? spacedName : componentName;
  const moduleShortName = componentName.endsWith('Module')
    ? componentName.replace(/Module$/, '')
    : null;

  let componentBtn = picker.locator('button').filter({
    has: page.locator('.font-medium', { hasText: displayName }),
  }).first();

  if (await componentBtn.count() === 0 && moduleShortName) {
    componentBtn = picker.locator('button').filter({
      has: page.locator('.font-medium', { hasText: moduleShortName }),
    }).first();
  }
  if (await componentBtn.count() === 0) {
    componentBtn = picker.locator('button').filter({ hasText: displayName }).first();
  }
  if (await componentBtn.count() === 0 && moduleShortName) {
    componentBtn = picker.locator('button').filter({ hasText: moduleShortName }).first();
  }
  if (await componentBtn.count() === 0) {
    componentBtn = picker.locator('button').filter({ hasText: componentName }).first();
  }

  await expect(componentBtn).toBeVisible({ timeout: 5000 });
  await componentBtn.evaluate((el) => {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    (el as HTMLButtonElement).click();
  });
  await page.waitForLoadState('networkidle');
}
