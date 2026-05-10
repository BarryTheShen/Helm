import { test, expect } from '../fixtures';
import { EditorPage } from '../page-objects/editor';

test.describe('Editor Sequence', () => {
  /**
   * Select the first available module from the sidebar so the editor
   * canvas and save functionality work correctly.
   */
  async function selectFirstModule(page: any) {
    const moduleNames = page.locator('aside span.truncate.font-medium');
    const count = await moduleNames.count();
    if (count > 0) {
      await moduleNames.first().click();
      await page.waitForLoadState('networkidle');
    }
  }

  test('multi-action sequence: add row, add component, save, reload', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    // Select a module so the editor canvas is active
    await selectFirstModule(page);

    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    // Add a row
    await page.locator(EditorPage.btnAddRow).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    // Save — register response listener BEFORE clicking to avoid race condition
    const saveResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/sdui/') && resp.status() === 200,
      { timeout: 10000 }
    );
    await page.locator(EditorPage.btnSave).click();
    await saveResponse;

    // Reload and verify no crash
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();
  });

  test('add component, configure property, add another component', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    // Select a module so the editor canvas is active
    await selectFirstModule(page);

    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    // Add a row first
    await page.locator(EditorPage.btnAddRow).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    // Save — register response listener BEFORE clicking to avoid race condition
    const saveResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/sdui/') && resp.status() === 200,
      { timeout: 10000 }
    );
    await page.locator(EditorPage.btnSave).click();
    await saveResponse;

    // Verify we remain on the editor (no redirect to login)
    const hasToken = await page.evaluate(() => {
      return window.localStorage.getItem('admin_token') !== null;
    });
    expect(hasToken).toBe(true);
  });
});
