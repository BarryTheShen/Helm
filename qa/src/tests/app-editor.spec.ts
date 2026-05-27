import { test, expect } from '../fixtures';
import {
  AppEditorPage,
  ensureModuleInstanceForAppEditor,
  waitForAppEditorReady,
  waitForAppEditorModules,
  openBrowserPreview,
  closeBrowserPreview,
  saveAppAndWait,
} from '../page-objects/app-editor';

test.describe('App Editor (FF4-QA-002)', () => {
  test.beforeAll(async ({ request }) => {
    await ensureModuleInstanceForAppEditor(request);
  });

  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/app-editor');
    await waitForAppEditorReady(page);
  });

  test('page loads with toolbar, bottom bar config, and iPhone mockup', async ({ page }) => {
    expect(page.url()).toContain('/app-editor');
    await expect(page.locator(AppEditorPage.btnSave)).toBeVisible();
    await expect(page.locator(AppEditorPage.btnPreview)).toBeVisible();
    await expect(page.locator(AppEditorPage.btnPublishToolbar).first()).toBeVisible();
    await expect(page.locator(AppEditorPage.bottomBarHeading)).toBeVisible();
    await expect(page.getByText('9:41').first()).toBeVisible();
  });

  test('BrowserPreview opens from preview picker (not module editor AppPreview)', async ({ page }) => {
    await openBrowserPreview(page);

    const previewModal = page.locator('.fixed.inset-0').filter({
      has: page.locator(AppEditorPage.browserPreviewHeading),
    });
    await expect(previewModal.locator(AppEditorPage.browserPreviewHeading)).toBeVisible();
    await expect(previewModal.getByText('Mode: Web Admin')).toBeVisible();
    await expect(previewModal.getByText('App working draft')).toBeVisible();
    await expect(previewModal.getByText('Screens loaded:')).toBeVisible();

    await closeBrowserPreview(page);
  });

  test('launchpad sidebar lists modules and add-to-bottom-bar control', async ({ page }) => {
    await waitForAppEditorModules(page);
    const sidebar = page.locator('.w-80').last();
    await expect(sidebar.getByRole('heading', { name: 'Launchpad' })).toBeVisible();
    await expect(
      sidebar.getByText('Modules not in the bottom bar appear in the launchpad'),
    ).toBeVisible();

    const addToBarButtons = sidebar.locator('button[title="Add to bottom bar"]');
    const moduleCount = await addToBarButtons.count();
    if (moduleCount > 0) {
      await expect(addToBarButtons.first()).toBeVisible();
      const moduleName = await sidebar.locator('.text-sm.font-medium.truncate').first().textContent();
      expect(moduleName?.trim().length).toBeGreaterThan(0);
    }
  });

  test('module version pinning switches to specific version when versions exist', async ({ page }) => {
    await waitForAppEditorModules(page);
    const addToBar = page.locator('button[title="Add to bottom bar"]').first();
    if (await addToBar.count() > 0) {
      await addToBar.click();
      await expect(page.getByText(/Added .+ to bottom bar/)).toBeVisible({ timeout: 10000 });
    }

    const useSpecificRadio = page.getByRole('radio', { name: /Use specific/i }).first();
    await expect(useSpecificRadio).toBeVisible({ timeout: 10000 });

    await useSpecificRadio.check();
    await expect(useSpecificRadio).toBeChecked();

    const versionSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Select a version...' }) })
      .first();
    await expect(versionSelect).toBeVisible({ timeout: 10000 });
    const optionCount = await versionSelect.locator('option').count();
    if (optionCount <= 1) {
      return;
    }

    const firstVersionValue = await versionSelect.locator('option').nth(1).getAttribute('value');
    expect(firstVersionValue).toBeTruthy();
    await versionSelect.selectOption(firstVersionValue!);
    await expect(page.getByText(/Pinned:/).first()).toBeVisible({ timeout: 10000 });
  });

  test('save app draft smoke', async ({ page }) => {
    await saveAppAndWait(page);
    await expect(page.getByText('App saved successfully')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('/app-editor');
  });

  test('publish modal opens as smoke check', async ({ page }) => {
    await page.locator(AppEditorPage.btnPublishToolbar).first().click();
    await expect(page.locator(AppEditorPage.publishModalHeading)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('Publishing will save the current app configuration'),
    ).toBeVisible();
    expect(page.url()).toContain('/app-editor');

    await page
      .locator('.fixed.inset-0')
      .filter({ has: page.locator(AppEditorPage.publishModalHeading) })
      .getByRole('button', { name: '✕' })
      .click();
    await expect(page.locator(AppEditorPage.publishModalHeading)).toHaveCount(0);
  });
});
