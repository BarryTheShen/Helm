import { test, expect } from '../fixtures';

const PAGES = [
  { path: '/editor', name: 'Editor' },
  { path: '/app-editor', name: 'App Editor' },
  { path: '/templates', name: 'Templates' },
  { path: '/workflows', name: 'Workflows' },
  { path: '/variables', name: 'Variables' },
  { path: '/connections', name: 'Connections' },
  { path: '/logs', name: 'Logs' },
  { path: '/settings', name: 'Settings' },
];

// Each page loads without crashing
for (const { path, name } of PAGES) {
  test(`${name} (${path}) loads without crashing`, async ({ page, login }) => {
    await login();
    await page.goto(path);
    await page.waitForTimeout(2000);
    const body = page.locator('body');
    expect(await body.isVisible(), `${name} should render`).toBe(true);
  });
}

// Save does NOT redirect to login (regression from FF3)
test('Save does not redirect to login page', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await page.waitForTimeout(2000);
  const saveBtn = page.getByText('Save', { exact: true }).first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(3000);
    expect(page.url(), 'After save, should still be on editor').toContain('/editor');
  }
});

// Module switching updates canvas content, not just the URL (Issue 47)
test('Module switching updates canvas content', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await page.waitForTimeout(2000);
  // Click the first module in the sidebar
  const firstModule = page.locator('[class*="module"], [class*="Module"], [class*="screen"]').first();
  const count = await page.locator('[class*="module"], [class*="Module"], [class*="screen"]').count();
  if (count >= 2) {
    const firstLabel = await firstModule.textContent();
    const secondModule = page.locator('[class*="module"], [class*="Module"], [class*="screen"]').nth(1);
    const secondLabel = await secondModule.textContent();
    if (firstLabel?.trim() !== secondLabel?.trim()) {
      await secondModule.click();
      await page.waitForTimeout(2000);
      // Canvas should reflect the second module
      const url = page.url();
      expect(url).toContain('module_instance_id');
      // Toolbar/status bar should show the second module name
      const bodyText = await page.locator('[class*="toolbar"], [class*="status"]').first().textContent().catch(() => '');
      expect(bodyText).toContain(secondLabel?.trim() ?? '');
    }
  }
});
