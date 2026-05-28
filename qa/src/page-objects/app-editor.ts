import { expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function qaAuthHeaders(): Record<string, string> {
  const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
  return { Authorization: `Bearer ${auth.token}` };
}

/** Ensure at least one module instance exists for launchpad/pinning tests. */
export async function ensureModuleInstanceForAppEditor(
  request: import('@playwright/test').APIRequestContext,
) {
  const headers = qaAuthHeaders();
  const instancesResp = await request.get('http://127.0.0.1:8000/api/modules/instances', { headers });
  const instances = await instancesResp.json();
  if ((instances.items ?? []).length > 0) {
    await ensureModulePreviewScreenForAppEditor(request);
    return;
  }

  const templatesResp = await request.get('http://127.0.0.1:8000/api/templates', { headers });
  const templatesPayload = await templatesResp.json();
  const templates = Array.isArray(templatesPayload)
    ? templatesPayload
    : templatesPayload.items ?? [];
  const homeTemplate = templates.find((t: { name?: string }) => t.name === 'Home');
  if (!homeTemplate?.id) return;

  await request.post('http://127.0.0.1:8000/api/modules/install', {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: { template_id: homeTemplate.id, name: 'Home' },
  });

  await ensureModulePreviewScreenForAppEditor(request);
}

/** Seed a minimal module draft so App Editor preview resolves SDUI (FF4-QA-005). */
export async function ensureModulePreviewScreenForAppEditor(
  request: import('@playwright/test').APIRequestContext,
) {
  const headers = qaAuthHeaders();
  const instancesResp = await request.get('http://127.0.0.1:8000/api/modules/instances', { headers });
  const instances = await instancesResp.json();
  const moduleId = instances.items?.[0]?.module_instance_id as string | undefined;
  if (!moduleId) return;

  const draftResp = await request.get(
    `http://127.0.0.1:8000/api/modules/${moduleId}/draft`,
    { headers },
  );
  if (draftResp.ok()) {
    const draft = await draftResp.json();
    if (draft.sdui_json?.rows?.length > 0) return;
  }

  const previewMarker = `Preview smoke ${Date.now()}`;
  await request.put(`http://127.0.0.1:8000/api/modules/${moduleId}/draft`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: {
      sdui_json: {
        rows: [
          {
            id: 'preview-row-1',
            height: 'auto',
            cells: [
              {
                id: 'preview-cell-1',
                width: 1,
                content: {
                  id: 'preview-text-1',
                  type: 'Text',
                  props: { content: previewMarker, variant: 'heading' },
                },
              },
            ],
          },
        ],
      },
      dirty: true,
    },
  });
}

export const AppEditorPage = {
  loadingText: 'text=Loading app editor...',
  bottomBarHeading: 'text=Bottom Bar (5 slots max)',
  launchpadSidebarHeading: '.w-80 >> text=Launchpad',
  btnSave: 'button:has-text("Save")',
  btnPreview: 'button:has-text("Preview")',
  btnPublishToolbar: 'button:has-text("Publish to Mobile")',
  previewPickerHeading: 'role=heading[name="Preview App"]',
  browserPreviewOption: 'role=heading[name="Preview in Web Admin"]',
  browserPreviewHeading: 'role=heading[name="Preview in Web Admin"]',
  publishModalHeading: 'role=heading[name=/Publish App/]',
};

/** Wait until App Editor finished loading apps/modules. */
export async function waitForAppEditorReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator(AppEditorPage.loadingText)).toHaveCount(0, { timeout: 20000 });

  const saveBtn = page.getByRole('button', { name: 'Save' });
  const createBtn = page.getByRole('button', { name: 'Create New App' });
  await expect(saveBtn.or(createBtn)).toBeVisible({ timeout: 20000 });

  if (await createBtn.isVisible()) {
    await createBtn.click();
    await expect(saveBtn).toBeVisible({ timeout: 15000 });
  }

  await expect(page.locator(AppEditorPage.bottomBarHeading)).toBeVisible({ timeout: 15000 });
}

/** Wait until module instances and version controls are available. */
export async function waitForAppEditorModules(page: import('@playwright/test').Page) {
  await expect
    .poll(
      async () => {
        const launchpadModules = await page.locator('button[title="Add to bottom bar"]').count();
        const versionRadios = await page.getByRole('radio', { name: /Use specific/i }).count();
        return launchpadModules + versionRadios;
      },
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);
}

/** Open BrowserPreview via Preview picker (FF4-APP-014). */
export async function openBrowserPreview(page: import('@playwright/test').Page) {
  await page.locator(AppEditorPage.btnPreview).click();
  await expect(page.locator(AppEditorPage.previewPickerHeading)).toBeVisible({ timeout: 10000 });

  await page.locator(AppEditorPage.browserPreviewOption).click();
  await expect(page.locator(AppEditorPage.browserPreviewHeading)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Resolving app draft and module versions...')).toHaveCount(0, {
    timeout: 30000,
  });
}

export async function closeBrowserPreview(page: import('@playwright/test').Page) {
  const modal = page.locator('.fixed.inset-0').filter({
    has: page.locator(AppEditorPage.browserPreviewHeading),
  });
  await modal.getByTitle('Close preview').click();
  await expect(page.locator(AppEditorPage.browserPreviewHeading)).toHaveCount(0, { timeout: 10000 });
}

/** Click Save and wait for draft PUT. */
export async function saveAppAndWait(page: import('@playwright/test').Page) {
  const saveResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/apps/')
      && resp.url().includes('/draft')
      && resp.request().method() === 'PUT'
      && resp.status() === 200,
    { timeout: 20000 },
  );
  await page.locator(AppEditorPage.btnSave).click();
  await saveResponse;
}

/** First installed module instance id for API seeding in FF4 App Editor tests. */
export async function getFirstModuleInstanceId(
  request: import('@playwright/test').APIRequestContext,
): Promise<string | undefined> {
  const headers = qaAuthHeaders();
  const instancesResp = await request.get('http://127.0.0.1:8000/api/modules/instances', { headers });
  const instances = await instancesResp.json();
  return instances.items?.[0]?.module_instance_id as string | undefined;
}

/** Create a checkpoint and archive it; returns archived version id (FF4-APP-022). */
export async function archiveNewestModuleVersion(
  request: import('@playwright/test').APIRequestContext,
  moduleId: string,
): Promise<string> {
  const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
  await request.post(`http://127.0.0.1:8000/api/modules/${moduleId}/checkpoints`, {
    headers,
    data: { change_summary: 'E2E archived version test' },
  });
  const versionsResp = await request.get(`http://127.0.0.1:8000/api/modules/${moduleId}/versions`, {
    headers: qaAuthHeaders(),
  });
  const versions = await versionsResp.json();
  const versionId = versions.items?.[0]?.id as string;
  expect(versionId).toBeTruthy();
  const archiveResp = await request.post(
    `http://127.0.0.1:8000/api/modules/${moduleId}/versions/${versionId}/archive`,
    { headers: qaAuthHeaders() },
  );
  expect(archiveResp.ok()).toBeTruthy();
  return versionId;
}

/** Seed a device render error visible in App Editor device errors panel (FF4-APP-024). */
export async function seedDeviceRenderError(
  request: import('@playwright/test').APIRequestContext,
  appId: string,
  deviceName = 'Barry\'s iPhone',
): Promise<void> {
  const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
  const deviceResp = await request.post('http://127.0.0.1:8000/api/devices', {
    headers,
    data: { device_id: `ff4-error-${Date.now()}`, device_name: deviceName },
  });
  expect(deviceResp.ok()).toBeTruthy();
  const deviceId = (await deviceResp.json()).id as string;
  const assignResp = await request.put(`http://127.0.0.1:8000/api/devices/${deviceId}/app`, {
    headers,
    data: { app_id: appId },
  });
  expect(assignResp.ok()).toBeTruthy();
  const reportResp = await request.post(`http://127.0.0.1:8000/api/devices/${deviceId}/error`, {
    headers,
    data: {
      error_type: 'render_error',
      error_message: `${deviceName} failed to update: Unsupported component type 'ArticleCard'.`,
      error_details: {
        unsupported_type: 'ArticleCard',
        installed_runtime: '1.0.0',
        required_runtime: '1.2.0',
      },
    },
  });
  expect(reportResp.status()).toBe(201);
}
