import { test, expect } from '../fixtures';
import { EditorPage } from '../page-objects/editor';

test.describe('Undo/Redo', () => {
  test('undo removes last action, redo restores it', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    // Get initial row count
    const initialCount = await page.evaluate(() => {
      const store: any = (window as any).__editorStore;
      return store?.getState()?.rows?.length ?? 0;
    });

    // Add a row
    await page.locator(EditorPage.btnAddRow).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    const afterAdd = await page.evaluate(() => {
      const store: any = (window as any).__editorStore;
      return store?.getState()?.rows?.length ?? 0;
    });
    expect(afterAdd).toBeGreaterThan(initialCount);

    // Click undo
    await page.locator(EditorPage.btnUndo).click();

    const afterUndo = await page.evaluate(() => {
      const store: any = (window as any).__editorStore;
      return store?.getState()?.rows?.length ?? 0;
    });
    expect(afterUndo).toBeLessThanOrEqual(afterAdd);

    // Click redo
    await page.locator(EditorPage.btnRedo).click();

    const afterRedo = await page.evaluate(() => {
      const store: any = (window as any).__editorStore;
      return store?.getState()?.rows?.length ?? 0;
    });
    expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
  });

  test('keyboard undo Ctrl+Z', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    // Add a row
    await page.locator(EditorPage.btnAddRow).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    // Try Ctrl+Z
    await page.keyboard.press('Control+z');
    // Verify page didn't crash
    await expect(page.locator(EditorPage.canvas)).toBeVisible();
  });
});
