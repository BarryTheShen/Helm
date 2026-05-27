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

test.describe('App Editor preview (FF4-APP-014/020, FF4-QA-005)', () => {
  test.beforeAll(async ({ request }) => {
    await ensureModuleInstanceForAppEditor(request);
  });

  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/app-editor');
    await waitForAppEditorReady(page);
    await waitForAppEditorModules(page);
  });

  test('BrowserPreview shows full app shell with bottom bar and launchpad', async ({ page }) => {
    await openBrowserPreview(page);

    const modal = page.locator('[data-testid="browser-preview-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-testid="app-phone-shell"]')).toBeVisible();
    await expect(modal.locator('[data-testid="app-phone-bottom-bar"]')).toBeVisible();

    await modal.getByRole('button', { name: 'Show Launchpad' }).click();
    await expect(modal.locator('[data-testid="app-phone-launchpad"]')).toBeVisible();

    await closeBrowserPreview(page);
  });

  test('BrowserPreview renders module SDUI in embedded preview', async ({ page }) => {
    const addToBar = page.locator('button[title="Add to bottom bar"]').first();
    if (await addToBar.count() > 0) {
      await addToBar.click();
      await expect(page.getByText(/Added .+ to bottom bar/)).toBeVisible({ timeout: 10000 });
    }

    await openBrowserPreview(page);

    const modal = page.locator('[data-testid="browser-preview-modal"]');
    const bottomBar = modal.locator('[data-testid="app-phone-bottom-bar"] button');
    await expect(bottomBar.first()).toBeVisible({ timeout: 10000 });
    await bottomBar.first().click();
    await expect(modal.locator('[data-testid="sdui-preview-embedded"]')).toBeVisible({
      timeout: 15000,
    });

    await closeBrowserPreview(page);
  });

  test('dark mode toggle is reflected in BrowserPreview theme info', async ({ page }) => {
    const darkModeCheckbox = page.getByRole('checkbox', { name: /Dark Mode/i });
    await darkModeCheckbox.check();
    await saveAppAndWait(page);

    await openBrowserPreview(page);

    const modal = page.locator('[data-testid="browser-preview-modal"]');
    await expect(modal.getByText('Theme: Dark')).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('[data-testid="app-phone-shell"][data-theme="dark"]')).toBeVisible();

    await closeBrowserPreview(page);
  });

  test('in-editor phone mockup renders embedded SDUI when module selected', async ({ page }) => {
    const addToBar = page.locator('button[title="Add to bottom bar"]').first();
    if (await addToBar.count() > 0) {
      await addToBar.click();
      await expect(page.getByText(/Added .+ to bottom bar/)).toBeVisible({ timeout: 10000 });
    }

    const bottomBarTab = page.locator('[data-testid="app-phone-bottom-bar"] button').first();
    await expect(bottomBarTab).toBeVisible({ timeout: 10000 });
    await bottomBarTab.click();
    await expect(page.locator('[data-testid="sdui-preview-embedded"]')).toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('App Editor coverage (FF4-QA-002)', () => {
  test.beforeAll(async ({ request }) => {
    await ensureModuleInstanceForAppEditor(request);
  });

  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/app-editor');
    await waitForAppEditorReady(page);
    await waitForAppEditorModules(page);
  });

  test('dark mode persists in app draft after save', async ({ page }) => {
    const darkModeCheckbox = page.getByRole('checkbox', { name: /Dark Mode/i });
    await darkModeCheckbox.check();

    const draftResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/apps/')
        && resp.url().includes('/draft')
        && resp.request().method() === 'PUT'
        && resp.status() === 200,
      { timeout: 20000 },
    );
    await page.locator(AppEditorPage.btnSave).click();
    const response = await draftResponse;
    const body = await response.json();
    expect(body.config_json?.dark_mode).toBe(true);
  });
});
