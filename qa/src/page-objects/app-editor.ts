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
  if ((instances.items ?? []).length > 0) return;

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
