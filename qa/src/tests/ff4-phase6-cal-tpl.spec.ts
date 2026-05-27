import { test, expect } from '../fixtures';
import { TemplatesPage } from '../page-objects/templates';
import { EditorPage, waitForEditorReady } from '../page-objects/editor';
import { addComponentToFirstCell, createFreshEditorModule } from '../editor-helpers';
import { cleanupCustomModuleFromEditorUrl } from '../test-artifact-cleanup';

async function openApplyModalForTemplate(page: import('@playwright/test').Page, templateName: string) {
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible({ timeout: 15000 });
  const card = page.locator(TemplatesPage.templateCards).filter({ hasText: templateName }).first();
  await expect(card).toBeVisible();
  await card.locator(TemplatesPage.btnApply).click();
  await expect(page.locator(TemplatesPage.applyModal)).toBeVisible();
}

async function applyTemplateToFirstModule(page: import('@playwright/test').Page) {
  const moduleSelect = page.locator(TemplatesPage.applyModuleSelect);
  await expect(moduleSelect).toBeVisible();
  const optionCount = await moduleSelect.locator('option').count();
  if (optionCount <= 1) {
    await page.locator(TemplatesPage.applyTargetNew).click();
    await page.getByPlaceholder('Enter module name...').fill(`QA Module ${Date.now()}`);
  } else {
    await moduleSelect.selectOption({ index: 1 });
  }
  const applyResponse = page.waitForResponse(
    (resp) => resp.url().includes('/api/templates/') && resp.url().includes('/apply') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.locator(TemplatesPage.applyAsDraftBtn).click();
  await applyResponse;
}

test.describe('FF4 Phase 6 — calendar, templates, empty container', () => {
  test.describe('Calendar inspector and preview (FF4-CAL-008/009/019)', () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
      await createFreshEditorModule(page);
    });

    test.afterEach(async ({ page, request }) => {
      await cleanupCustomModuleFromEditorUrl(request, page.url());
    });

    test('FF4-CAL-019: calendar inspector exposes required fields', async ({ page }) => {
      await addComponentToFirstCell(page, 'CalendarModule');
      await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();
      await expect(page.locator(EditorPage.selectVariant)).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('View Type')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Title (optional)')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Max Events (Event List/Compact)')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Source Types (comma-separated)')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Category Filter')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Show Source Badges')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Show Notes')).toBeVisible();
      await expect(page.locator(EditorPage.propertyInspector).getByText('Compact Threshold (px)')).toBeVisible();
    });

    test('FF4-CAL-008: month variant supports date tap agenda and event details', async ({ page }) => {
      await addComponentToFirstCell(page, 'CalendarModule');
      const canvas = page.locator(EditorPage.canvas);
      const calendar = canvas.locator('[data-testid="calendar-preview"][data-variant="month"]').first();
      await expect(calendar).toBeVisible();
      await expect(calendar.locator('[data-testid="calendar-month-grid"]')).toBeVisible();
      await expect(calendar.locator('[data-testid="calendar-agenda"]')).toBeVisible();

      const todayCell = calendar.locator('[data-testid="calendar-today"]');
      await expect(todayCell).toBeVisible();
      await todayCell.click({ force: true });

      const agendaEvent = calendar.locator('[data-testid^="calendar-agenda-event-"]').first();
      await expect(agendaEvent).toBeVisible({ timeout: 10000 });
      await agendaEvent.evaluate((el) => (el as HTMLButtonElement).click());
      await expect(calendar.locator('[data-testid="calendar-event-detail"]')).toBeVisible({ timeout: 10000 });
    });

    test('FF4-CAL-009: week variant renders time-block grid with event blocks', async ({ page }) => {
      await addComponentToFirstCell(page, 'CalendarModule');
      await page.locator(EditorPage.selectVariant).selectOption('week');
      const calendar = page.locator(EditorPage.canvas).locator('[data-testid="calendar-preview"][data-variant="week"]').first();
      await expect(calendar).toBeVisible({ timeout: 10000 });
      await expect(calendar.locator('[data-testid="calendar-time-grid"]')).toBeVisible();
      await expect(calendar.locator('[data-testid^="calendar-time-event-"]').first()).toBeVisible();
    });
  });

  test.describe('Templates UI and apply flow (FF4-TPL-001/005/006, FF4-CAL-020)', () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
    });

    test('FF4-TPL-005/006: apply modal has version, target, checkpoint, cancel/apply; no mobile publish', async ({ page }) => {
      await openApplyModalForTemplate(page, 'Home');
      await expect(page.locator(TemplatesPage.applyVersionSelect)).toBeVisible();
      await expect(page.locator(TemplatesPage.applyTargetExisting)).toBeVisible();
      await expect(page.locator(TemplatesPage.applyTargetNew)).toBeVisible();
      await expect(page.locator(TemplatesPage.applyAutoCheckpoint)).toBeVisible();
      await expect(page.locator(TemplatesPage.applyCancelBtn)).toBeVisible();
      await expect(page.locator(TemplatesPage.applyAsDraftBtn)).toBeVisible();
      await expect(page.getByRole('button', { name: /Publish to Mobile/i })).toHaveCount(0);
      await page.locator(TemplatesPage.applyCancelBtn).click();
      await expect(page.locator(TemplatesPage.applyModal)).toHaveCount(0);
    });

    test('FF4-TPL-001: Home template applies and renders without Unknown components', async ({ page }) => {
      await openApplyModalForTemplate(page, 'Home');
      await applyTemplateToFirstModule(page);
      await page.goto('/editor');
      await waitForEditorReady(page);
      await expect(page.locator(EditorPage.unknownLabel)).toHaveCount(0);
      await expect(page.locator('[data-testid="calendar-preview"]')).toBeVisible();
    });

    test('FF4-CAL-020: Home template uses compact calendar in 50/50 row', async ({ page }) => {
      await openApplyModalForTemplate(page, 'Home');
      await applyTemplateToFirstModule(page);
      await page.goto('/editor');
      await waitForEditorReady(page);
      await expect(page.locator('[data-testid="calendar-preview"][data-variant="compact"]')).toBeVisible();
    });

    test('FF4-EC-004 / FF4-CAL-020: Daily Planner stacks Calendar, Todo, Notes vertically in Empty container', async ({ page }) => {
      await openApplyModalForTemplate(page, 'Daily Planner');
      await applyTemplateToFirstModule(page);
      await page.goto('/editor');
      await waitForEditorReady(page);

      const container = page.locator('[data-testid="empty-container-preview"]').first();
      await expect(container).toBeVisible();
      await expect(container.locator('[data-testid="calendar-preview"][data-variant="week"]')).toBeVisible();
      await expect(container.locator('text=To-Do').first()).toBeVisible();
      await expect(container.locator('text=Notes').first()).toBeVisible();
    });

    test('FF4-NOTES-003: Home template includes Notes and + New Note server action', async ({ page, request }) => {
      await openApplyModalForTemplate(page, 'Home');
      await applyTemplateToFirstModule(page);

      const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
      const templatesResp = await request.get('/api/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(templatesResp.ok()).toBeTruthy();
      const templatesBody = await templatesResp.json();
      const homeTemplate = (templatesBody.items ?? []).find((item: { name?: string }) => item.name === 'Home');
      expect(homeTemplate?.id).toBeTruthy();

      const detailResp = await request.get(`/api/templates/${homeTemplate.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const detail = await detailResp.json();
      const screenJson = JSON.stringify(detail.screen_json);
      expect(screenJson).toContain('NotesModule');
      expect(screenJson).toContain('notes.create');
    });
  });
});
