import { test, expect } from '../fixtures';
import { TemplatesPage } from '../page-objects/templates';
import { WorkflowsPage } from '../page-objects/workflows';

test.describe('FF4 Phase 12 — templates, workflows, MCP-QA', () => {
  test('FF4-TPL-003/004: template detail is JSON and apply modal supports checkpoint flow', async ({ page, login, request }) => {
    await login();
    await page.goto('/templates');
    await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible({ timeout: 15000 });

    const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
    const listResp = await request.get('/api/templates', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listResp.ok()).toBeTruthy();
    const items = (await listResp.json()).items ?? [];
    expect(items.length).toBeGreaterThan(0);

    const detailResp = await request.get(`/api/templates/${items[0].id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = await detailResp.json();
    expect(typeof detail.screen_json).toBe('object');
    expect(Array.isArray(detail.screen_json.rows)).toBe(true);

    const card = page.locator(TemplatesPage.templateCards).first();
    await card.locator(TemplatesPage.btnApply).click();
    await expect(page.locator(TemplatesPage.applyModal)).toBeVisible();
    await expect(page.locator(TemplatesPage.applyAutoCheckpoint)).toBeVisible();
    await expect(page.locator(TemplatesPage.applyAsDraftBtn)).toBeVisible();
  });

  test('FF4-WF-001: workflows API exposes seeded sample workflows when present', async ({ page, login, request }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();

    const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
    const resp = await request.get('/api/workflows', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.ok()).toBeTruthy();
    const names = new Set(((await resp.json()).items ?? []).map((item: { name?: string }) => item.name));

    if (names.has('Daily Summary')) {
      await expect(page.getByText('Daily Summary')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Event Reminder')).toBeVisible();
      await expect(page.getByText('New Todo Alert')).toBeVisible();
    } else {
      await expect(page.locator(WorkflowsPage.btnNewWorkflow)).toBeVisible();
    }
  });

  test('FF4-QA-006: Connections page loads for end-to-end admin flow', async ({ page, login }) => {
    await login();
    await page.goto('/connections');
    await expect(page.getByRole('heading', { name: /Connections/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Connection|New Connection/i }).first()).toBeVisible();
  });
});
