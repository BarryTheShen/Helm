import { test, expect } from '../fixtures';
import { EditorPage, waitForEditorReady } from '../page-objects/editor';
import {
  AppEditorPage,
  ensureModuleInstanceForAppEditor,
  waitForAppEditorReady,
  waitForAppEditorModules,
  closeBrowserPreview,
} from '../page-objects/app-editor';
import { WorkflowsPage } from '../page-objects/workflows';
import { TemplatesPage } from '../page-objects/templates';
import {
  addComponentToFirstCell,
  createFreshEditorModule,
  ensureEmptyCellExists,
  ensureMultiCellRow,
} from '../editor-helpers';
import { cleanupCustomModuleFromEditorUrl } from '../test-artifact-cleanup';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function qaAuthHeaders(): Record<string, string> {
  const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
  return { Authorization: `Bearer ${auth.token}` };
}

async function applyTemplateToNewModule(
  page: import('@playwright/test').Page,
  templateName: string,
  moduleName: string,
): Promise<string> {
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible({ timeout: 15000 });
  const card = page.locator(TemplatesPage.templateCards).filter({ hasText: templateName }).first();
  await expect(card).toBeVisible();
  await card.locator(TemplatesPage.btnApply).click();
  await expect(page.locator(TemplatesPage.applyModal)).toBeVisible();
  await page.locator(TemplatesPage.applyTargetNew).click();
  await page.getByPlaceholder('Enter module name...').fill(moduleName);
  const applyResponse = page.waitForResponse(
    (resp) => resp.url().includes('/apply') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.locator(TemplatesPage.applyAsDraftBtn).click();
  const body = await (await applyResponse).json() as { module_id?: string };
  expect(body.module_id).toBeTruthy();
  return body.module_id!;
}

test.describe('FF3 supplemental PARTIAL closure', () => {
  test.describe('Module Editor', () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
      await page.goto('/editor');
      await waitForEditorReady(page);
    });

    test.afterEach(async ({ page, request }) => {
      await cleanupCustomModuleFromEditorUrl(request, page.url());
    });

    test('FF3-MOD-PREVIEW-001: module preview modal renders draft', async ({ page }) => {
      await page.locator('[data-testid="btn-preview-web"]').click();
      await expect(page.locator('[data-testid="module-editor-preview"]')).toBeVisible({ timeout: 10000 });
    });

    test('FF3-ROW-TYPES-001: add row menu has no header/footer/content type picker', async ({ page }) => {
      await expect(page.locator('[data-testid="btn-add-row"]')).toBeVisible();
      await expect(page.getByText(/header row/i)).toHaveCount(0);
      await expect(page.getByText(/footer row/i)).toHaveCount(0);
      await expect(page.getByText(/content row type/i)).toHaveCount(0);
    });

    test('FF3-ROW-PRESETS-001: add-cell picker excludes template preset entries', async ({ page }) => {
      await ensureEmptyCellExists(page);
      await page.locator('[data-testid="editor-canvas"] .hover\\:bg-blue-50').first().click();
      const picker = page.locator('.shadow-xl').filter({ hasText: 'Atomic Components' });
      await expect(picker).toBeVisible({ timeout: 10000 });
      await expect(picker.getByText('Heading', { exact: true })).toHaveCount(0);
      await expect(picker.getByText('Body Text', { exact: true })).toHaveCount(0);
    });

    test('FF3-ROW-CELL-STRETCH-001: cells stretch when row height increases', async ({ page }) => {
      await ensureMultiCellRow(page);
      const row = page.locator('[data-testid="editor-canvas"] .group.rounded-lg').first();
      const cell = row.locator(':scope > .flex.min-h-\\[48px\\] > div.rounded').first();
      const initialCellHeight = (await cell.boundingBox())?.height ?? 0;

      const handle = row.locator('[data-testid="row-height-resize-handle"]');
      await expect(handle).toBeVisible();
      const handleBox = await handle.boundingBox();
      expect(handleBox).toBeTruthy();

      const startX = handleBox!.x + handleBox!.width / 2;
      const startY = handleBox!.y + handleBox!.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX, startY + 80, { steps: 12 });
      await page.mouse.up();

      const stretchedHeight = (await cell.boundingBox())?.height ?? 0;
      expect(stretchedHeight).toBeGreaterThan(initialCellHeight + 40);
    });

    test('FF3-VAR-PILL-001: variable pill typing and preview resolution', async ({ page }) => {
      await createFreshEditorModule(page);
      await ensureEmptyCellExists(page);
      await addComponentToFirstCell(page, 'Text', { emptyCell: 'last' });

      const editor = page.locator('[data-testid="property-inspector"] .ProseMirror').first();
      await editor.click();
      await page.keyboard.type('Hi ');
      await page.keyboard.press('@');
      await page.locator('.shadow-xl button').filter({ hasText: 'user.email' }).first().click();
      await page.keyboard.type(' there');

      const preview = page.locator('[data-testid="editor-canvas"] [data-testid="text-preview"]').last();
      await expect(preview).toContainText('john@example.com', { timeout: 10000 });
      await expect(preview).toContainText('there');
    });

    test('FF3-ICON-UX-001: icon picker shows lucide icons not raw text labels', async ({ page }) => {
      await addComponentToFirstCell(page, 'Icon');
      const trigger = page.locator('[data-testid="icon-picker-trigger"]').first();
      await trigger.click();
      await expect(page.locator('[data-testid="icon-picker-option"]').first()).toBeVisible();
      await page.locator('[data-testid="icon-picker-option"]').filter({ hasText: 'star' }).first().click();
      await expect(page.locator('svg.lucide-star').first()).toBeVisible({ timeout: 10000 });
    });

    test('FF3-EC-VERTICAL-001: Empty container stacks children vertically', async ({ page }) => {
      await addComponentToFirstCell(page, 'Empty');
      const container = page.locator('[data-testid="empty-container-preview"]').first();
      await expect(container).toHaveClass(/flex-col/);
    });

    test('FF3-CAL-VARIANT-001: calendar variant persists after inspector blur', async ({ page }) => {
      await createFreshEditorModule(page);
      await addComponentToFirstCell(page, 'CalendarModule');
      await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();
      await page.locator(EditorPage.selectVariant).selectOption('week');
      await expect(
        page.locator('[data-testid="calendar-preview"][data-variant="week"]').first(),
      ).toBeVisible({ timeout: 10000 });
      await page.locator(EditorPage.selectVariant).selectOption('compact');
      await page.locator(EditorPage.canvas).click();
      await expect(
        page.locator('[data-testid="calendar-preview"][data-variant="compact"]').first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test('FF3-MD-RENDER-001: markdown heading renders in canvas preview', async ({ page }) => {
      await ensureEmptyCellExists(page);
      await addComponentToFirstCell(page, 'Text', { emptyCell: 'last' });
      const heading = page.locator('[data-testid="editor-canvas"]').getByRole('heading').last();
      await expect(heading).toBeVisible({ timeout: 10000 });
      await expect(heading).not.toContainText('#');
    });

    test('FF3-SESS10-RENAME-MODAL-001: rename modal lists affected apps', async ({ page, request }) => {
      const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
      const modResp = await request.post('http://127.0.0.1:8000/api/sdui/modules', {
        headers,
        data: { name: `FF3 Rename ${Date.now()}` },
      });
      const moduleId = (await modResp.json()).module_id as string;

      const appResp = await request.post('http://127.0.0.1:8000/api/apps', { headers, data: { name: 'FF3 Rename App' } });
      const appId = (await appResp.json()).id as string;
      const draftResp = await request.put(`http://127.0.0.1:8000/api/apps/${appId}/draft`, {
        headers,
        data: {
          config_json: {
            name: 'FF3 Rename App',
            bottom_bar_config: [
              {
                module_instance_id: moduleId,
                module_type: 'custom',
                name: 'Rename Mod',
                icon: '📦',
                slot_position: 0,
              },
            ],
            launchpad_config: [],
          },
          dirty: true,
        },
      });
      expect(draftResp.ok()).toBeTruthy();

      await page.goto(`/editor?module_instance_id=${moduleId}`);
      await waitForEditorReady(page);

      const moduleRow = page.locator('aside span.truncate.font-medium').filter({ hasText: /FF3 Rename/i }).first();
      await moduleRow.click({ button: 'right' });
      await page.locator('[data-testid="module-context-menu"]').getByRole('menuitem', { name: 'Rename' }).click();
      await expect(page.getByRole('heading', { name: 'Rename Module' })).toBeVisible();
      await expect(page.locator('[data-testid="module-affected-apps"]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('FF3 Rename App')).toBeVisible();
    });

    test('FF3-SESS10-DELETE-MODAL-001: delete modal lists affected apps', async ({ page, request }) => {
      const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
      const modResp = await request.post('http://127.0.0.1:8000/api/sdui/modules', {
        headers,
        data: { name: `FF3 Delete ${Date.now()}` },
      });
      const moduleId = (await modResp.json()).module_id as string;

      const appResp = await request.post('http://127.0.0.1:8000/api/apps', { headers, data: { name: 'FF3 Delete App' } });
      const appId = (await appResp.json()).id as string;
      const draftResp = await request.put(`http://127.0.0.1:8000/api/apps/${appId}/draft`, {
        headers,
        data: {
          config_json: {
            name: 'FF3 Delete App',
            bottom_bar_config: [
              {
                module_instance_id: moduleId,
                module_type: 'custom',
                name: 'Delete Mod',
                icon: '📦',
                slot_position: 0,
              },
            ],
            launchpad_config: [],
          },
          dirty: true,
        },
      });
      expect(draftResp.ok()).toBeTruthy();

      await page.goto(`/editor?module_instance_id=${moduleId}`);
      await waitForEditorReady(page);

      const moduleRow = page.locator('aside span.truncate.font-medium').filter({ hasText: /FF3 Delete/i }).first();
      await moduleRow.click({ button: 'right' });
      await page.locator('[data-testid="module-context-menu"]').getByRole('menuitem', { name: 'Delete' }).click();
      await expect(page.getByRole('heading', { name: 'Delete Module' })).toBeVisible();
      await expect(page.locator('[data-testid="module-affected-apps"]')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('FF3 Delete App')).toBeVisible();
    });
  });

  test('FF3-SESS10-RENAME-001: admin nav uses Module Editor label', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await expect(page.getByRole('button', { name: 'Module Editor' })).toBeVisible();
    await expect(page.getByText('Screen Editor')).toHaveCount(0);
  });

  test.describe('Templates', () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
    });

    test('FF3-TPL-HOME-001: Home template applies without unknown components', async ({ page }) => {
      const moduleId = await applyTemplateToNewModule(page, 'Home', `FF3 Home ${Date.now()}`);
      await page.goto(`/editor?module_instance_id=${moduleId}`);
      await waitForEditorReady(page);
      await expect(page.locator(EditorPage.unknownLabel)).toHaveCount(0);
      await expect(page.locator('[data-testid="calendar-preview"]')).toBeVisible();
    });

    test('FF3-TPL-PLANNER-001: Daily Planner vertical Empty stack renders', async ({ page }) => {
      const moduleId = await applyTemplateToNewModule(page, 'Daily Planner', `FF3 Planner ${Date.now()}`);
      await page.goto(`/editor?module_instance_id=${moduleId}`);
      await waitForEditorReady(page);
      const container = page.locator('[data-testid="empty-container-preview"]').first();
      await expect(container).toBeVisible();
      await expect(container.locator('[data-testid="calendar-preview"][data-variant="week"]')).toBeVisible();
    });

    test('FF3-TPL-FEED-001: Feed template ArticleCard and RichText editable', async ({ page }) => {
      const moduleId = await applyTemplateToNewModule(page, 'Feed', `FF3 Feed ${Date.now()}`);
      await page.goto(`/editor?module_instance_id=${moduleId}`);
      await waitForEditorReady(page);
      await expect(page.locator(EditorPage.unknownLabel)).toHaveCount(0);
      await expect(page.getByText('Welcome to Your Feed').first()).toBeVisible();
    });
  });

  test('FF3-WF-ACTION-001: action nodes expose connectable handles', async ({ page, login }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/workflows') && resp.request().method() === 'POST' && resp.status() === 201,
    );
    await page.locator(WorkflowsPage.btnNewWorkflow).click();
    await page.locator(WorkflowsPage.createNameInput).fill(`FF3 Action ${Date.now()}`);
    await page.locator(WorkflowsPage.createCreateBtn).click();
    await createResponse;
    await page.locator(WorkflowsPage.addNodeAction).click();
    const handles = page.locator('.react-flow__node').first().locator('.react-flow__handle');
    await expect(handles).toHaveCount(2, { timeout: 10000 });
  });

  test('FF3-SET-DEVICE-001: settings shows device management without admin panels', async ({ page, login }) => {
    await login();
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Device Management' })).toBeVisible();
    await expect(page.getByText('Admin Panel')).toHaveCount(0);
  });

  test.describe('App Editor Session 10', () => {
    test.beforeAll(async ({ request }) => {
      await ensureModuleInstanceForAppEditor(request);
    });

    test.beforeEach(async ({ page, login }) => {
      await login();
      await page.goto('/app-editor');
      await waitForAppEditorReady(page);
      await waitForAppEditorModules(page);
    });

    test('FF3-SESS10-BBAR-001: sixth module rejected when bottom bar full', async ({ page, request }) => {
      await expect(page.getByText('Bottom Bar (5 slots max)')).toBeVisible();

      const guard = await page.evaluate(async () => {
        const source = await (await fetch('/src/pages/AppEditorPage.tsx')).text();
        return (
          source.includes('bottom_bar_config.length >= 5')
          && source.includes('Bottom bar is full (5 slots max)')
        );
      });
      expect(guard).toBe(true);

      const headers = { ...qaAuthHeaders(), 'Content-Type': 'application/json' };
      const appsResp = await request.get('http://127.0.0.1:8000/api/apps', { headers });
      const appId = ((await appsResp.json()).items ?? [])[0]?.id as string;
      expect(appId).toBeTruthy();

      const overflowBar = Array.from({ length: 6 }, (_, index) => ({
        module_instance_id: `overflow-mod-${index}`,
        module_type: 'custom',
        name: `Overflow ${index}`,
        icon: '📦',
        slot_position: index,
      }));
      const rejectResp = await request.put(`http://127.0.0.1:8000/api/apps/${appId}`, {
        headers,
        data: { bottom_bar_config: overflowBar },
      });
      expect(rejectResp.status()).toBe(400);
      expect(await rejectResp.json()).toMatchObject({
        detail: expect.stringMatching(/5/),
      });

      const addButtons = page.locator('button[title="Add to bottom bar"]');
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const slotText = await page.getByText(/\d\/5 slots used/).textContent();
        if (slotText?.startsWith('5/5') || (await addButtons.count()) === 0) {
          break;
        }
        await addButtons.first().click();
        await page.waitForTimeout(300);
      }

      if (await page.getByText('5/5 slots used').isVisible()) {
        if (await addButtons.count() > 0) {
          await addButtons.first().click();
          await expect(page.getByText('Bottom bar is full (5 slots max)')).toBeVisible({ timeout: 10000 });
        }
      }
    });

    test('FF3-SESS10-PREVIEW-001: preview picker offers web admin and device options', async ({ page }) => {
      await page.locator(AppEditorPage.btnPreview).click();
      await expect(page.getByRole('heading', { name: 'Preview App' })).toBeVisible();
      await expect(page.locator('[data-testid="preview-web-admin"]')).toBeVisible();
      await expect(page.locator('[data-testid="preview-on-device"]')).toBeVisible();
      await page.locator('[data-testid="preview-web-admin"]').click();
      await expect(page.locator(AppEditorPage.browserPreviewHeading)).toBeVisible({ timeout: 30000 });
      await closeBrowserPreview(page);
    });
  });

  test('FF3-NOTES-SAVE-001: notes API create succeeds from admin context', async ({ request, login, page }) => {
    await login();
    await page.goto('/editor');
    const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
    const resp = await request.post('http://127.0.0.1:8000/api/notes', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { title: 'FF3 E2E Note', content: 'Body' },
    });
    expect(resp.status()).toBe(201);
  });

  test('FF3-TODO-FUNC-001: todo API create succeeds', async ({ request, login, page }) => {
    await login();
    await page.goto('/editor');
    const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
    const resp = await request.post('http://127.0.0.1:8000/api/todos', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { text: 'FF3 E2E Todo', completed: false },
    });
    expect(resp.status()).toBe(201);
  });
});
