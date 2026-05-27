import { test, expect } from '../fixtures';
import { EditorPage, waitForEditorReady, saveModuleAndWait } from '../page-objects/editor';
import {
  AppEditorPage,
  ensureModuleInstanceForAppEditor,
  waitForAppEditorReady,
  waitForAppEditorModules,
} from '../page-objects/app-editor';
import { addComponentToFirstCell } from '../editor-helpers';

test.describe('FF4 Phase 5 — editor surfaces', () => {
  test.describe('Module Editor (FF4-MOD-004, MOD-015, CELL-002, TEXT-002/003, VER-008)', () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
      await page.goto('/editor');
      await waitForEditorReady(page);
    });

    test('FF4-MOD-004: new module save button enabled and persists', async ({ page }) => {
      const createResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/sdui/modules')
          && resp.request().method() === 'POST'
          && resp.status() === 201,
        { timeout: 15000 },
      );
      await page.locator('[data-testid="btn-new-module"]').click();
      const created = await createResponse;
      const body = await created.json();
      expect(body.module_id).toBeTruthy();

      await expect(page).toHaveURL(new RegExp(`module_instance_id=${body.module_id}`));
      await waitForEditorReady(page);
      await expect(page.locator(EditorPage.btnSave)).toBeEnabled();

      await saveModuleAndWait(page);
      await expect(page.getByText(/Module (saved|draft saved)/i)).toBeVisible({ timeout: 10000 });
    });

    test('FF4-MOD-015: required toolbar controls present; no publish/approve controls', async ({ page }) => {
      await expect(page.locator(EditorPage.toolbar)).toBeVisible();
      await expect(page.locator('[data-testid="btn-checkpoint"]')).toBeVisible();
      await expect(page.locator('[data-testid="btn-version-history"]')).toBeVisible();
      await expect(page.locator('[data-testid="btn-preview-web"]')).toBeVisible();
      await expect(page.locator(EditorPage.btnSave)).toBeVisible();

      await expect(page.getByRole('button', { name: /Publish to Mobile/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Approve/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Reject/i })).toHaveCount(0);
    });

    test('FF4-CELL-002: row and cell delete buttons on left side', async ({ page }) => {
      await addComponentToFirstCell(page, 'Text');
      const canvas = page.locator(EditorPage.canvas);
      const row = canvas.locator('[data-testid^="btn-delete-row-"]').first();
      const cell = canvas.locator('[data-testid^="btn-delete-cell-"]').first();

      await canvas.hover();
      await row.hover({ force: true });
      await expect(row).toBeVisible();

      const rowBox = await row.boundingBox();
      const cellBox = await cell.boundingBox();
      expect(rowBox).toBeTruthy();
      expect(cellBox).toBeTruthy();
      if (rowBox && cellBox) {
        expect(rowBox.x).toBeLessThan(cellBox.x + cellBox.width);
      }
    });

    test('FF4-TEXT-002: Enter in Text inspector creates newline in canvas preview', async ({ page }) => {
      await addComponentToFirstCell(page, 'Text');
      const lineOne = `LineA-${Date.now()}`;
      const lineTwo = `LineB-${Date.now()}`;

      const editor = page.locator(EditorPage.propertyInspector).locator('.ProseMirror').first();
      await editor.click();
      await page.keyboard.type(lineOne);
      await page.keyboard.press('Enter');
      await page.keyboard.type(lineTwo);

      await expect(page.locator('[data-testid="editor-canvas"]').getByText(lineOne)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="editor-canvas"]').getByText(lineTwo)).toBeVisible();
    });

    test('FF4-TEXT-003: Text alignment center applies in preview', async ({ page }) => {
      await addComponentToFirstCell(page, 'Text');
      const alignSelect = page
        .locator(EditorPage.propertyInspector)
        .locator('label', { hasText: 'Align' })
        .locator('..')
        .locator('select');
      await alignSelect.selectOption('center');
      const aligned = page.locator('[data-testid="editor-canvas"] div[style*="text-align: center"]').first();
      await expect(aligned).toBeVisible({ timeout: 10000 });
    });

    test('FF4-VER-008: version history modal shows tree actions and used-by panel', async ({ page }) => {
      await page.locator('[data-testid="btn-version-history"]').click();
      const modal = page.locator('[data-testid="version-history-modal"]');
      await expect(modal).toBeVisible({ timeout: 10000 });
      await expect(modal.getByText(/Version History/i)).toBeVisible();
      await expect(modal.getByText(/Used by/i)).toBeVisible();

      const hasVersions = await modal.getByRole('button', { name: 'Restore' }).count();
      if (hasVersions > 0) {
        await expect(modal.getByRole('button', { name: 'JSON' }).first()).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Archive' }).first()).toBeVisible();
      }

      await modal.getByRole('button', { name: '✕' }).click();
      await expect(modal).toHaveCount(0);
    });
  });

  test.describe('App Editor (FF4-APP-001/003/012/013/022)', () => {
    test.beforeAll(async ({ request }) => {
      await ensureModuleInstanceForAppEditor(request);
    });

    test.beforeEach(async ({ page, login }) => {
      await login();
      await page.goto('/app-editor');
      await waitForAppEditorReady(page);
      await waitForAppEditorModules(page);
    });

    test('FF4-APP-003: phone mockup is center + bottom bar only (no inner sidebars)', async ({ page }) => {
      await expect(page.locator('[data-testid="app-phone-shell"]')).toBeVisible();
      await expect(page.locator('[data-testid="app-phone-bottom-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="app-phone-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="app-phone-shell"] .w-80')).toHaveCount(0);
    });

    test('FF4-APP-012: required App Editor UI elements present', async ({ page }) => {
      const sidebar = page.locator('.w-80').last();
      await expect(page.locator(AppEditorPage.btnSave)).toBeVisible();
      await expect(page.locator(AppEditorPage.btnPreview)).toBeVisible();
      await expect(page.locator(AppEditorPage.btnPublishToolbar).first()).toBeVisible();
      await expect(page.locator('[data-testid="btn-version-history"]')).toBeVisible();
      await expect(page.locator(AppEditorPage.bottomBarHeading)).toBeVisible();
      await expect(sidebar.getByRole('heading', { name: 'Launchpad' })).toBeVisible();
      await expect(sidebar.getByText('App Properties')).toBeVisible();
      await expect(page.getByRole('radio', { name: /Use newest/i }).first()).toBeVisible();
    });

    test('FF4-APP-001/013: module icon picker updates launchpad icon', async ({ page }) => {
      const sidebar = page.locator('.w-80').last();
      const editBtn = sidebar.locator('[data-testid="module-icon-edit"]').first();
      await expect(editBtn).toBeVisible({ timeout: 10000 });
      await editBtn.click();

      const picker = sidebar.locator('[data-testid="icon-picker-trigger"]').first();
      await picker.click();
      await sidebar.locator('[data-testid="icon-picker-option"]').filter({ hasText: 'star' }).first().click();

      await expect(sidebar.locator('svg.lucide-star').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="app-phone-shell"] svg.lucide-star').first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Settings (FF4-QA-008)', () => {
    test('FF4-QA-008: device list excludes admin web panels', async ({ page, login }) => {
      await login();
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: 'Device Management' })).toBeVisible();
      await expect(page.getByText('Admin Panel')).toHaveCount(0);

      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const name = await rows.nth(i).locator('td').first().textContent();
        expect(name?.toLowerCase()).not.toContain('admin panel');
      }
    });
  });
});
