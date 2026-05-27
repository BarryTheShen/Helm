import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { EditorPage } from './page-objects/editor';

/**
 * Ensure there is at least one row with an empty cell on the canvas.
 * If no empty cells exist, clicks "Add Row" to create one.
 *
 * Uses a retry pattern with a generous timeout to handle cases where
 * the editor canvas DOM element exists but the child cells haven't
 * finished rendering yet (common on first load / slow networks).
 */
export async function ensureEmptyCellExists(page: Page) {
  // Empty cells are inside the editor canvas with bg-gray-50 + border-dashed
  const emptyCellLocator = page.locator('[data-testid="editor-canvas"] .bg-gray-50.border-dashed');
  const addRowBtn = page.locator(EditorPage.addRowByText);

  // First, ensure data fetches have settled
  await page.waitForLoadState('networkidle');

  // Retry: wait up to 10s for at least one empty cell to become visible.
  // This handles the case where cells haven't rendered yet after navigation.
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
 * Add a component to the first empty cell on the canvas.
 * Assumes ensureEmptyCellExists() has been called.
 */
export async function addComponentToFirstCell(page: Page, componentName: string) {
  await expect(page.locator(EditorPage.canvas)).toBeVisible();

  // Find the first empty cell: it has bg-gray-50 + border-dashed and lives inside the canvas
  const canvasEmptyCells = page.locator('[data-testid="editor-canvas"] .bg-gray-50.border-dashed');

  // Component picker doesn't have a data-testid; identify it by its heading text
  const componentPicker = page.getByText('Add Component').first();

  if (await canvasEmptyCells.count() > 0) {
    await canvasEmptyCells.first().click();
    await expect(componentPicker).toBeVisible({ timeout: 5000 });
  } else {
    // If no empty cell found, add a row first
    const addRowBtn = page.locator(EditorPage.addRowByText);
    if (await addRowBtn.count() > 0) {
      await addRowBtn.first().click();
      await expect(canvasEmptyCells.first()).toBeVisible({ timeout: 5000 });
    }
    // Now try again
    if (await canvasEmptyCells.count() > 0) {
      await canvasEmptyCells.first().click();
      await expect(componentPicker).toBeVisible({ timeout: 5000 });
    }
  }

  // Find the component in the picker list and click it
  // The picker shows display names which may differ from type names:
  // e.g. type="TextInput" → displayName="Text Input"
  // Try exact match first, then fall back to button search in the picker
  let componentBtn = page.getByText(componentName, { exact: true }).first();
  if (await componentBtn.count() === 0) {
    // Fallback: use CamelCase→spaced conversion for display name differences
    // e.g. "TextInput" → "Text Input"
    const spacedName = componentName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
    if (spacedName !== componentName) {
      componentBtn = page.getByText(spacedName, { exact: true }).first();
    }
  }
  if (await componentBtn.count() === 0) {
    // Last resort: search within the picker container for buttons containing the name
    const picker = page.locator('.shadow-xl').filter({ hasText: 'Add Component' });
    componentBtn = picker.locator('button').filter({ hasText: componentName }).first();
  }

  if (await componentBtn.count() > 0) {
    await componentBtn.click();
    await page.waitForLoadState('networkidle');
  }
}
