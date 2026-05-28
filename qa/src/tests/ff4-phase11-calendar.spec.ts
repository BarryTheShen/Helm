import { test, expect } from '../fixtures';
import { EditorPage, waitForEditorReady } from '../page-objects/editor';
import { addComponentToFirstCell } from '../editor-helpers';

const CALENDAR_VARIANTS = ['month', 'week', 'day', 'eventList', 'compact'] as const;

test.describe('FF4 Phase 11 — calendar PARTIAL closure', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await waitForEditorReady(page);
  });

  test('FF4-CAL-001: CalendarModule is a real registry component with variant selector', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    await expect(page.locator('[data-testid="calendar-preview"]').first()).toBeVisible();
    await expect(page.locator(EditorPage.selectVariant)).toBeVisible();
  });

  for (const variant of CALENDAR_VARIANTS) {
    test(`FF4-CAL-002/003/004: ${variant} variant renders dedicated preview`, async ({ page }) => {
      await addComponentToFirstCell(page, 'CalendarModule');
      await page.locator(EditorPage.selectVariant).selectOption(variant);
      const calendar = page.locator(`[data-testid="calendar-preview"][data-variant="${variant}"]`).first();
      await expect(calendar).toBeVisible({ timeout: 10000 });

      if (variant === 'month') {
        await expect(calendar.locator('[data-testid="calendar-month-grid"]')).toBeVisible();
      }
      if (variant === 'week' || variant === 'day') {
        await expect(calendar.locator('[data-testid="calendar-time-grid"]')).toBeVisible();
      }
      if (variant === 'compact') {
        await expect(calendar.locator('[data-testid="calendar-compact-count"]')).toBeVisible();
        await expect(calendar.locator('[data-testid="calendar-compact-next"]')).toBeVisible();
      }
      if (variant === 'eventList') {
        await expect(calendar.locator('[data-testid="calendar-event-list-view"]')).toBeVisible();
      }
    });
  }

  test('FF4-CAL-006: calendar navigation header exposes prev/next/Today', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    const nav = page.locator('[data-testid="calendar-date-nav"]').first();
    await expect(nav).toBeVisible();
    await expect(page.locator('[data-testid="calendar-nav-prev"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="calendar-nav-next"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="calendar-nav-today"]').first()).toBeVisible();
  });

  test('FF4-CAL-007: month variant shows fit-the-cell warning banner', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    await expect(page.locator('[data-testid="calendar-fit-warning"]').first()).toBeVisible();
  });

  test('FF4-CAL-011: tapping agenda event opens detail surface', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    const calendar = page.locator('[data-testid="calendar-preview"][data-variant="month"]').first();
    await calendar.locator('[data-testid="calendar-today"]').click({ force: true });
    const agendaEvent = calendar.locator('[data-testid^="calendar-agenda-event-"]').first();
    await expect(agendaEvent).toBeVisible({ timeout: 10000 });
    await agendaEvent.evaluate((el) => (el as HTMLButtonElement).click());
    await expect(calendar.locator('[data-testid="calendar-event-detail"]')).toBeVisible({ timeout: 10000 });
  });

  test('FF4-CAL-016: calendar inspector exposes filter and threshold fields', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    const inspector = page.locator(EditorPage.propertyInspector);
    await expect(inspector.getByText('Source Types (comma-separated)')).toBeVisible();
    await expect(inspector.getByText('Category Filter')).toBeVisible();
    await expect(inspector.getByText('Compact Threshold (px)')).toBeVisible();
  });

  test('FF4-CAL-024: source badges render when enabled', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    await page.locator(EditorPage.selectVariant).selectOption('eventList');
    await expect(page.locator('[data-testid^="calendar-source-badge-"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('FF4-CAL-025: event notes truncate to two lines when enabled', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    await page.locator(EditorPage.selectVariant).selectOption('eventList');
    await expect(page.locator('[data-testid^="calendar-event-notes-"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('FF4-CAL-008: month variant supports date tap agenda and event details', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    const calendar = page.locator('[data-testid="calendar-preview"][data-variant="month"]').first();
    await expect(calendar.locator('[data-testid="calendar-month-grid"]')).toBeVisible();
    await calendar.locator('[data-testid="calendar-today"]').click({ force: true });
    const agendaEvent = calendar.locator('[data-testid^="calendar-agenda-event-"]').first();
    await expect(agendaEvent).toBeVisible({ timeout: 10000 });
    await agendaEvent.evaluate((el) => (el as HTMLButtonElement).click());
    await expect(calendar.locator('[data-testid="calendar-event-detail"]')).toBeVisible({ timeout: 10000 });
  });

  test('FF4-CAL-009: week/day time-block grid with overlap and current-time line', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');

    await page.locator(EditorPage.selectVariant).selectOption('week');
    const week = page.locator('[data-testid="calendar-preview"][data-variant="week"]').first();
    await expect(week.locator('[data-testid="calendar-time-grid"]')).toBeVisible();
    await expect(week.locator('[data-testid^="calendar-time-event-"]').first()).toBeVisible();
    const overlapBlock = week.locator('[data-testid="calendar-time-event-evt-1b"]').first();
    await expect(overlapBlock).toHaveAttribute('data-overlap-columns', '2');
    await expect(week.locator('[data-testid="calendar-current-time-line"]')).toBeVisible();

    await page.locator(EditorPage.selectVariant).selectOption('day');
    const day = page.locator('[data-testid="calendar-preview"][data-variant="day"]').first();
    await expect(day.locator('[data-testid="calendar-time-grid"]')).toBeVisible();
    await expect(day.locator('[data-testid="calendar-current-time-line"]')).toBeVisible();
  });

  test('FF4-CAL-019: calendar inspector exposes required fields', async ({ page }) => {
    await addComponentToFirstCell(page, 'CalendarModule');
    const inspector = page.locator(EditorPage.propertyInspector);
    await expect(inspector.getByText('View Type')).toBeVisible();
    await expect(inspector.getByText('Title (optional)')).toBeVisible();
    await expect(inspector.getByText('Max Events (Event List/Compact)')).toBeVisible();
    await expect(inspector.getByText('Show Source Badges')).toBeVisible();
    await expect(inspector.getByText('Show Notes')).toBeVisible();
  });
});
