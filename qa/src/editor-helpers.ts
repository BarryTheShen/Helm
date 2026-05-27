import type { Page } from '@playwright/test';
import { expect } from './fixtures';
import { EditorPage, addRowViaStructureTree, waitForEditorReady } from './page-objects/editor';

type EditorStoreState = {
  rows: Array<{ id: string; cells: Array<{ content: unknown | null }> }>;
  setComponent: (rowId: string, cellIndex: number, type: string) => void;
  setCellCount: (rowId: string, count: number) => void;
};

async function countEmptyCellsInStore(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: { getState: () => EditorStoreState } }).__editorStore;
    if (!store) return 0;
    return store.getState().rows.reduce(
      (count, row) => count + row.cells.filter((cell) => !cell.content).length,
      0,
    );
  });
}

async function setComponentInEmptyCell(
  page: Page,
  componentType: string,
  preferLast: boolean,
): Promise<void> {
  await page.evaluate(({ componentType, preferLast }) => {
    const store = (window as unknown as { __editorStore?: { getState: () => EditorStoreState } }).__editorStore;
    if (!store) {
      throw new Error('__editorStore not available');
    }
    const { rows, setComponent } = store.getState();
    const candidates: Array<{ rowId: string; cellIndex: number }> = [];
    for (const row of rows) {
      row.cells.forEach((cell, cellIndex) => {
        if (!cell.content) {
          candidates.push({ rowId: row.id, cellIndex });
        }
      });
    }
    const target = preferLast ? candidates.at(-1) : candidates[0];
    if (!target) {
      throw new Error('No empty cell found in editor store');
    }
    setComponent(target.rowId, target.cellIndex, componentType);
  }, { componentType, preferLast });
}

/**
 * Create a fresh empty module in the editor and wait until the store is loaded.
 * Returns the new custom module id (for teardown via deleteCustomModule).
 */
export async function createFreshEditorModule(page: Page): Promise<string> {
  await page.goto('/editor');
  await waitForEditorReady(page);

  const createResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/sdui/modules')
      && resp.request().method() === 'POST'
      && resp.status() === 201,
    { timeout: 15000 },
  );
  await page.locator('[data-testid="btn-new-module"]').click();
  const response = await createResponse;
  const created = (await response.json()) as { module_id?: string };
  if (created.module_id) {
    await page.waitForURL(`**module_instance_id=${created.module_id}**`, { timeout: 15000 });
  }
  await waitForEditorReady(page);
  await expect.poll(async () => page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: { getState: () => EditorStoreState } }).__editorStore;
    return store?.getState().rows.length ?? -1;
  }), { timeout: 15000 }).toBe(0);
  return created.module_id ?? '';
}

/**
 * Ensure there is at least one row with an empty cell on the canvas.
 * If no empty cells exist, clicks "Add Row" to create one.
 */
export async function ensureEmptyCellExists(page: Page) {
  await page.waitForLoadState('networkidle');

  await expect(async () => {
    if ((await countEmptyCellsInStore(page)) === 0) {
      await addRowViaStructureTree(page);
    }
    expect(await countEmptyCellsInStore(page)).toBeGreaterThan(0);
  }).toPass({ timeout: 15000 });
}

/**
 * Ensure a row exists with at least two cells and a visible resize handle.
 */
export async function ensureMultiCellRow(page: Page) {
  await ensureEmptyCellExists(page);

  const resizeHandle = page.locator('[data-testid="editor-canvas"] [data-testid^="cell-resize-handle-"]');
  if (await resizeHandle.count() > 0) {
    return;
  }

  await page.evaluate(() => {
    const store = (window as unknown as { __editorStore?: { getState: () => EditorStoreState } }).__editorStore;
    if (!store) {
      throw new Error('__editorStore not available');
    }
    const { rows, setCellCount } = store.getState();
    const row = rows.at(-1);
    if (!row) {
      throw new Error('No row available to expand to multi-cell layout');
    }
    if (row.cells.length < 2) {
      setCellCount(row.id, 2);
    }
  });

  await expect(resizeHandle.first()).toBeVisible({ timeout: 10000 });
}

/**
 * Add a component to an empty cell on the canvas.
 * Uses the editor store for deterministic placement.
 */
export async function addComponentToFirstCell(
  page: Page,
  componentName: string,
  options?: { emptyCell?: 'first' | 'last' },
) {
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await ensureEmptyCellExists(page);

  const preferLast = options?.emptyCell === 'last';
  await setComponentInEmptyCell(page, componentName, preferLast);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(EditorPage.propertyInspector)).toBeVisible({ timeout: 10000 });
}
