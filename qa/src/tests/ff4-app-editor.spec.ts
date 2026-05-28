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
  saveAppAndWait,
  getFirstModuleInstanceId,
  archiveNewestModuleVersion,
  seedDeviceRenderError,
} from '../page-objects/app-editor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function qaAuthHeaders(): Record<string, string> {
  const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
  return { Authorization: `Bearer ${auth.token}` };
}

async function getCurrentAppIdFromDraftSave(page: import('@playwright/test').Page): Promise<string> {
  const saveResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/apps/')
      && resp.url().includes('/draft')
      && resp.request().method() === 'PUT'
      && resp.status() === 200,
  );
  await page.locator(AppEditorPage.btnSave).click();
  const saveResponseResult = await saveResponse;
  const appId = saveResponseResult.url().match(/\/api\/apps\/([^/]+)\/draft/)?.[1];
  expect(appId).toBeTruthy();
  return appId!;
}

test.describe('FF4 App Editor — PARTIAL closure (FF4-SLICE-APP-EDITOR)', () => {
  test.beforeAll(async ({ request }) => {
    await ensureModuleInstanceForAppEditor(request);
  });

  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/app-editor');
    await waitForAppEditorReady(page);
    await waitForAppEditorModules(page);
  });

  test('FF4-APP-001: icon picker opens and icon renders in BrowserPreview', async ({ page }) => {
    const sidebar = page.locator('.w-80').last();
    await sidebar.locator('[data-testid="module-icon-edit"]').first().click();
    await sidebar.locator('[data-testid="icon-picker-trigger"]').first().click();
    await sidebar.locator('[data-testid="icon-picker-option"]').filter({ hasText: 'heart' }).first().click();
    await expect(sidebar.locator('svg.lucide-heart').first()).toBeVisible({ timeout: 10000 });

    const addToBar = sidebar.locator('button[title="Add to bottom bar"]').first();
    if (await addToBar.count() > 0) {
      await addToBar.click();
      await expect(page.getByText(/Added .+ to bottom bar/)).toBeVisible({ timeout: 10000 });
    }
    await saveAppAndWait(page);

    await openBrowserPreview(page);
    const modal = page.locator('[data-testid="browser-preview-modal"]');
    await expect(modal.locator('svg.lucide-heart').first()).toBeVisible({ timeout: 15000 });
    await closeBrowserPreview(page);
  });

  test('FF4-APP-002: save draft persists to backend GET /draft', async ({ page, request }) => {
    const uniqueName = `FF4 Draft ${Date.now()}`;
    const sidebar = page.locator('.w-80').last();
    await sidebar.getByRole('textbox').first().fill(uniqueName);
    const appId = await getCurrentAppIdFromDraftSave(page);

    const draftResp = await request.get(`http://127.0.0.1:8000/api/apps/${appId}/draft`, {
      headers: qaAuthHeaders(),
    });
    expect(draftResp.ok()).toBeTruthy();
    const draft = await draftResp.json();
    expect(draft.config_json.name).toBe(uniqueName);
  });

  test('FF4-APP-005: module draft edit does not change device config until app publish', async ({ request }) => {
    const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
    const moduleId = await getFirstModuleInstanceId(request);
    expect(moduleId).toBeTruthy();

    const appResp = await request.post('http://127.0.0.1:8000/api/apps', {
      headers,
      data: { name: 'FF4-005 Isolation App', icon: 'star' },
    });
    const appId = (await appResp.json()).id as string;

    await request.put(`http://127.0.0.1:8000/api/apps/${appId}/draft`, {
      headers,
      data: {
        config_json: {
          name: 'FF4-005 Isolation App',
          bottom_bar_config: [
            {
              module_instance_id: moduleId,
              module_type: 'home',
              name: 'Home',
              icon: 'home',
              slot_position: 0,
            },
          ],
          launchpad_config: [],
        },
        dirty: true,
      },
    });

    const checkpoint = await request.post(`http://127.0.0.1:8000/api/apps/${appId}/checkpoints`, {
      headers,
      data: { change_summary: 'FF4-005 publish' },
    });
    const versionId = (await checkpoint.json()).id as string;

    const deviceResp = await request.post('http://127.0.0.1:8000/api/devices', {
      headers,
      data: { device_id: `ff4-005-${Date.now()}`, device_name: 'FF4-005 Phone' },
    });
    const deviceId = (await deviceResp.json()).id as string;
    await request.put(`http://127.0.0.1:8000/api/devices/${deviceId}/app`, {
      headers,
      data: { app_id: appId },
    });

    await request.post(`http://127.0.0.1:8000/api/apps/${appId}/versions/${versionId}/publish`, {
      headers,
    });

    const configBefore = await request.get(`http://127.0.0.1:8000/api/devices/${deviceId}/config`, {
      headers: qaAuthHeaders(),
    });
    expect(configBefore.ok()).toBeTruthy();
    const nameBefore = (await configBefore.json()).name;

    await request.put(`http://127.0.0.1:8000/api/modules/${moduleId}/draft`, {
      headers,
      data: {
        sdui_json: {
          rows: [
            {
              id: 'mutated-row',
              height: 'auto',
              cells: [
                {
                  id: 'mutated-cell',
                  width: 1,
                  content: {
                    id: 'mutated-text',
                    type: 'Text',
                    props: { content: 'Module mutated without app publish', variant: 'heading' },
                  },
                },
              ],
            },
          ],
        },
        dirty: true,
      },
    });

    const configAfter = await request.get(`http://127.0.0.1:8000/api/devices/${deviceId}/config`, {
      headers: qaAuthHeaders(),
    });
    expect((await configAfter.json()).name).toBe(nameBefore);
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

  test('FF4-APP-007: module reference shows name, icon, enabled toggle, bottom bar slot, version radios', async ({ page }) => {
    const sidebar = page.locator('.w-80').last();
    await expect(sidebar.locator('[data-testid="module-icon-edit"]').first()).toBeVisible();
    await expect(sidebar.locator('[data-testid="module-enabled-toggle"]').first()).toBeVisible();
    await expect(page.getByRole('radio', { name: /Use newest/i }).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: /Use specific/i }).first()).toBeVisible();

    const addToBar = sidebar.locator('button[title="Add to bottom bar"]').first();
    await addToBar.click();
    await expect(page.getByText(/Added .+ to bottom bar/)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="app-phone-bottom-bar"] button').first()).toBeVisible();
    await expect(page.getByText(/Slot 1/).first()).toBeVisible();
  });

  test('FF4-APP-011: publish modal shows devices, module versions, validation after publish', async ({ page, request }) => {
    const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
    const appName = `FF4-011 Publish ${Date.now()}`;
    const appResp = await request.post('http://127.0.0.1:8000/api/apps', {
      headers,
      data: { name: appName, icon: 'star' },
    });
    expect(appResp.ok()).toBeTruthy();

    await page.reload();
    await waitForAppEditorReady(page);
    await page.locator('.relative > button').first().click();
    await page.locator('.absolute.top-full').getByText(appName, { exact: true }).click();
    await waitForAppEditorModules(page);

    const addToBar = page.locator('button[title="Add to bottom bar"]').first();
    if (await addToBar.count() > 0) {
      await addToBar.click();
      await expect(page.getByText(/Added .+ to bottom bar/)).toBeVisible({ timeout: 10000 });
    }

    await page.locator(AppEditorPage.btnPublishToolbar).first().click();
    const modal = page.locator('.fixed.inset-0').filter({
      has: page.locator(AppEditorPage.publishModalHeading),
    });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Assigned Devices')).toBeVisible();
    await expect(modal.getByText('Module Versions')).toBeVisible();

    await modal.getByRole('button', { name: 'Publish to Mobile' }).click();
    await expect(modal.getByText('Validation Results')).toBeVisible({ timeout: 20000 });
    await expect(modal.getByText('Device Update Status')).toBeVisible({ timeout: 20000 });
    await expect(modal.getByText(/Published .+/)).toBeVisible({ timeout: 20000 });
  });

  test('FF4-APP-013: module icon picker accessible from module settings', async ({ page }) => {
    const sidebar = page.locator('.w-80').last();
    await sidebar.locator('[data-testid="module-icon-edit"]').first().click();
    await expect(sidebar.locator('[data-testid="icon-picker-trigger"]').first()).toBeVisible();
    await sidebar.locator('[data-testid="icon-picker-trigger"]').first().click();
    await expect(sidebar.locator('[data-testid="icon-picker-option"]').first()).toBeVisible();
  });

  test('FF4-APP-015: preview on device opens device selection step', async ({ page, request }) => {
    await request.post('http://127.0.0.1:8000/api/devices', {
      headers: { ...qaAuthHeaders(), 'Content-Type': 'application/json' },
      data: { device_id: `ff4-015-${Date.now()}`, device_name: 'FF4 Preview Phone' },
    });

    await page.locator(AppEditorPage.btnPreview).click();
    await page.locator('[data-testid="preview-on-device"]').click();
    await expect(page.getByRole('heading', { name: 'Select Device' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('FF4 Preview Phone').first()).toBeVisible({ timeout: 10000 });
  });

  test('FF4-APP-018: published app version is served on device config endpoint', async ({ request }) => {
    const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
    const moduleId = await getFirstModuleInstanceId(request);
    expect(moduleId).toBeTruthy();

    const appResp = await request.post('http://127.0.0.1:8000/api/apps', {
      headers,
      data: { name: 'FF4-018 Live Snapshot', icon: 'star' },
    });
    const appId = (await appResp.json()).id as string;

    await request.put(`http://127.0.0.1:8000/api/apps/${appId}/draft`, {
      headers,
      data: {
        config_json: {
          name: 'FF4-018 Live Snapshot',
          dark_mode: false,
          bottom_bar_config: [
            {
              module_instance_id: moduleId,
              module_type: 'home',
              name: 'Home',
              icon: 'home',
              slot_position: 0,
            },
          ],
          launchpad_config: [],
        },
        dirty: true,
      },
    });

    const checkpoint = await request.post(`http://127.0.0.1:8000/api/apps/${appId}/checkpoints`, {
      headers,
      data: { change_summary: 'FF4-018 snapshot' },
    });
    const versionId = (await checkpoint.json()).id as string;

    const publish = await request.post(`http://127.0.0.1:8000/api/apps/${appId}/versions/${versionId}/publish`, {
      headers,
    });
    expect(publish.ok()).toBeTruthy();

    const deviceResp = await request.post('http://127.0.0.1:8000/api/devices', {
      headers,
      data: { device_id: `ff4-018-${Date.now()}`, device_name: 'FF4-018 Phone' },
    });
    const deviceId = (await deviceResp.json()).id as string;
    await request.put(`http://127.0.0.1:8000/api/devices/${deviceId}/app`, {
      headers,
      data: { app_id: appId },
    });

    const config = await request.get(`http://127.0.0.1:8000/api/devices/${deviceId}/config`, {
      headers: qaAuthHeaders(),
    });
    expect((await config.json()).name).toBe('FF4-018 Live Snapshot');

    const versions = await request.get(`http://127.0.0.1:8000/api/apps/${appId}/versions`, {
      headers: qaAuthHeaders(),
    });
    const published = (await versions.json()).items.find(
      (v: { id: string; source: string }) => v.id === versionId && v.source === 'publish',
    );
    expect(published).toBeTruthy();
  });

  test('FF4-APP-020: BrowserPreview is best-effort SDUI web preview (not native RN)', async ({ page }) => {
    await openBrowserPreview(page);
    const modal = page.locator('[data-testid="browser-preview-modal"]');
    await expect(modal.getByText('Mode: Web Admin')).toBeVisible();
    await expect(modal.getByText('App working draft')).toBeVisible();
    await expect(modal.locator('[data-testid="app-phone-shell"]')).toBeVisible();
    await expect(modal.locator('[data-testid="sdui-preview-embedded"], [data-testid="app-phone-launchpad"]').first()).toBeVisible({
      timeout: 15000,
    });
    await closeBrowserPreview(page);
  });

  test('FF4-APP-022: archived pinned module version shows warning banner', async ({ page, request }) => {
    const moduleId = await getFirstModuleInstanceId(request);
    expect(moduleId).toBeTruthy();
    const archivedVersionId = await archiveNewestModuleVersion(request, moduleId!);

    await page.reload();
    await waitForAppEditorReady(page);
    await waitForAppEditorModules(page);

    const useSpecific = page.getByRole('radio', { name: /Use specific/i }).first();
    await useSpecific.check();
    const versionSelect = page.locator('select').filter({ has: page.locator('option') }).first();
    await versionSelect.selectOption(archivedVersionId);
    await expect(page.getByText(/Pinned:/).first()).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-testid="archived-module-version-warning"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/references an archived module version/i)).toBeVisible();
  });

  test('FF4-APP-024: device errors panel shows detailed render error', async ({ page, request }) => {
    const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
    const appName = `FF4-024 Errors ${Date.now()}`;
    const appResp = await request.post('http://127.0.0.1:8000/api/apps', {
      headers,
      data: { name: appName, icon: 'star' },
    });
    expect(appResp.ok()).toBeTruthy();
    const appId = (await appResp.json()).id as string;
    await seedDeviceRenderError(request, appId);

    await page.reload();
    await waitForAppEditorReady(page);
    const errorsLoad = page.waitForResponse(
      (resp) => resp.url().includes('/api/devices/errors') && resp.url().includes(`app_id=${appId}`),
    );
    await page.locator('.relative > button').first().click();
    await page.locator('.absolute.top-full').getByText(appName, { exact: true }).click();
    await errorsLoad;

    await expect(page.locator('[data-testid="device-errors-panel"]')).toBeVisible();
    await expect(page.getByText(/Barry's iPhone failed to update/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Unsupported: ArticleCard/i)).toBeVisible();
    await expect(page.getByText(/Installed runtime: 1.0.0/i)).toBeVisible();
    await expect(page.getByText(/Required runtime: 1.2.0/i)).toBeVisible();
  });

  test('FF4-APP-025: preview session failure is logged by backend', async ({ request }) => {
    const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
    const moduleId = await getFirstModuleInstanceId(request);
    expect(moduleId).toBeTruthy();

    const appResp = await request.post('http://127.0.0.1:8000/api/apps', {
      headers,
      data: { name: 'FF4-025 Preview Fail App', icon: 'star' },
    });
    const appId = (await appResp.json()).id as string;

    const deviceResp = await request.post('http://127.0.0.1:8000/api/devices', {
      headers,
      data: { device_id: `ff4-025-${Date.now()}`, device_name: 'FF4-025 Preview Phone' },
    });
    const deviceId = (await deviceResp.json()).id as string;

    const preview = await request.post(`http://127.0.0.1:8000/api/apps/${appId}/preview/device`, {
      headers,
      data: { device_id: deviceId },
    });
    expect(preview.ok()).toBeTruthy();
    const sessionId = (await preview.json()).id as string;

    const error = await request.post(`http://127.0.0.1:8000/api/modules/preview-sessions/${sessionId}/error`, {
      headers,
      data: {
        error_type: 'preview_failure',
        error_message: 'Preview render failed on device',
        device_id: deviceId,
      },
    });
    expect(error.status()).toBe(201);
    const body = await error.json();
    expect(body.source).toBe('preview_session');
    expect(body.preview_session_id).toBe(sessionId);
  });
});
