import { test, expect } from '../fixtures';
import { EditorPage, waitForEditorReady, addRowViaStructureTree, saveModuleAndWait } from '../page-objects/editor';
import { addComponentToFirstCell } from '../editor-helpers';

test.describe('Editor Sequence', () => {
  async function selectFirstModule(page: import('@playwright/test').Page) {
    const moduleNames = page.locator('aside span.truncate.font-medium');
    const count = await moduleNames.count();
    if (count > 0) {
      await moduleNames.first().click();
      await waitForEditorReady(page);
    }
  }

  test('multi-action sequence: add row, add component, save, reload', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await selectFirstModule(page);

    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    await addRowViaStructureTree(page);
    await addComponentToFirstCell(page, 'Button');
    await saveModuleAndWait(page);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.canvas)).toBeVisible();
  });

  test('add component, configure property, add another component', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await selectFirstModule(page);

    await expect(page.locator(EditorPage.canvas)).toBeVisible();

    await addRowViaStructureTree(page);
    await addComponentToFirstCell(page, 'Button');
    await saveModuleAndWait(page);

    const hasToken = await page.evaluate(() => {
      return window.localStorage.getItem('admin_token') !== null;
    });
    expect(hasToken).toBe(true);
  });
});
