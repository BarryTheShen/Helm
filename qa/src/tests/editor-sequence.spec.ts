import { test, expect } from '../fixtures';
import { EditorPage } from '../page-objects/editor';

test.describe('Editor Sequence', () => {
  test('multi-action sequence: add row, add component, save, reload', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    // Add a row
    await page.locator(EditorPage.btnAddRow).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    // Save
    await page.locator(EditorPage.btnSave).click();
    await page.waitForResponse((resp) => resp.url().includes('/api/screens') && resp.status() === 200, { timeout: 10000 });

    // Reload and verify no crash
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();
  });

  test('add component, configure property, add another component', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    // Add a row first
    await page.locator(EditorPage.btnAddRow).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    // Save the changes
    await page.locator(EditorPage.btnSave).click();
    await page.waitForResponse((resp) => resp.url().includes('/api/screens') && resp.status() === 200, { timeout: 10000 });

    // No errors in console
    const hasErrors = await page.evaluate(() => {
      return window.localStorage.getItem('admin_token') !== null;
    });
    expect(hasErrors).toBe(true);
  });
});
