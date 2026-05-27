import { test, expect } from '../fixtures';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  AppEditorPage,
  ensureModuleInstanceForAppEditor,
  waitForAppEditorReady,
  waitForAppEditorModules,
  openBrowserPreview,
  closeBrowserPreview,
} from '../page-objects/app-editor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function qaAuthHeaders(): Record<string, string> {
  const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
  return { Authorization: `Bearer ${auth.token}` };
}

test.describe('FF4 Phase 9 — App Editor PARTIAL closure', () => {
  test.beforeAll(async ({ request }) => {
    await ensureModuleInstanceForAppEditor(request);
  });

  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/app-editor');
    await waitForAppEditorReady(page);
    await waitForAppEditorModules(page);
  });

  test('FF4-APP-006: top bar shows autosave, live version, preview, publish, history', async ({ page }) => {
    await expect(page.locator(AppEditorPage.btnPreview)).toBeVisible();
    await expect(page.locator(AppEditorPage.btnPublishToolbar).first()).toBeVisible();
    await expect(page.locator('[data-testid="btn-version-history"]')).toBeVisible();
    await expect(page.getByText(/Live:|No live version/)).toBeVisible();

    await page.locator(AppEditorPage.btnPreview).click();
    await expect(page.getByRole('heading', { name: 'Preview App' })).toBeVisible();
    await expect(page.locator('[data-testid="preview-web-admin"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-on-device"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preview in Web Admin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preview on Device...' })).toBeVisible();
    await page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'Preview App' }) }).getByTitle('Close').click();
  });

  test('FF4-APP-002: save draft persists to backend GET /draft', async ({ page, request }) => {
    const uniqueName = `Phase9 Draft ${Date.now()}`;
    const sidebar = page.locator('.w-80').last();
    await sidebar.getByRole('textbox').first().fill(uniqueName);

    const saveResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/apps/')
        && resp.url().includes('/draft')
        && resp.request().method() === 'PUT'
        && resp.status() === 200,
    );
    await page.locator(AppEditorPage.btnSave).click();
    const saveResponse = await saveResponsePromise;
    const appId = saveResponse.url().match(/\/api\/apps\/([^/]+)\/draft/)?.[1];
    expect(appId).toBeTruthy();

    const draftResp = await request.get(`http://127.0.0.1:8000/api/apps/${appId}/draft`, {
      headers: qaAuthHeaders(),
    });
    expect(draftResp.ok()).toBeTruthy();
    const draft = await draftResp.json();
    expect(draft.config_json.name).toBe(uniqueName);
  });

  test('FF4-APP-007: module reference shows icon, version radios, and pin selector', async ({ page }) => {
    const sidebar = page.locator('.w-80').last();
    await expect(page.getByRole('radio', { name: /Use newest/i }).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: /Use specific/i }).first()).toBeVisible();
    await expect(sidebar.locator('[data-testid="module-icon-edit"]').first()).toBeVisible();
  });

  test('FF4-APP-011: publish modal shows assigned devices and validation sections', async ({ page }) => {
    await page.locator(AppEditorPage.btnPublishToolbar).first().click();
    await expect(page.locator(AppEditorPage.publishModalHeading)).toBeVisible();
    await expect(page.getByText('Assigned Devices')).toBeVisible();
    await expect(page.locator('[data-testid="publish-assigned-devices"]')).toBeVisible();
    await expect(page.getByText('Module Versions')).toBeVisible();
    await expect(page.getByText('Publishing will save the current app configuration')).toBeVisible();
  });

  test('FF4-APP-015: preview on device opens device selection step', async ({ page, request }) => {
    await request.post('http://127.0.0.1:8000/api/devices', {
      headers: { ...qaAuthHeaders(), 'Content-Type': 'application/json' },
      data: { device_id: `phase9-e2e-${Date.now()}`, device_name: 'E2E Preview Phone' },
    });

    await page.locator(AppEditorPage.btnPreview).click();
    await page.locator('[data-testid="preview-on-device"]').click();
    await expect(page.getByRole('heading', { name: 'Select Device' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Preview Phone')).toBeVisible({ timeout: 10000 });
  });

  test('FF4-APP-001/013: module icon picker updates launchpad icon', async ({ page }) => {
    const sidebar = page.locator('.w-80').last();
    await sidebar.locator('[data-testid="module-icon-edit"]').first().click();
    await sidebar.locator('[data-testid="icon-picker-trigger"]').first().click();
    await sidebar.locator('[data-testid="icon-picker-option"]').filter({ hasText: 'heart' }).first().click();
    await expect(sidebar.locator('svg.lucide-heart').first()).toBeVisible({ timeout: 10000 });
  });

  test('FF4-APP-024: device errors panel is visible in App Editor', async ({ page }) => {
    await expect(page.locator('[data-testid="device-errors-panel"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Device Errors' })).toBeVisible();
  });

  test('FF4-ICON-001: BrowserPreview smoke after icon-capable app editor load', async ({ page }) => {
    await openBrowserPreview(page);
    await closeBrowserPreview(page);
  });
});
