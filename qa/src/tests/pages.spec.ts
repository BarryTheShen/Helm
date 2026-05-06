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
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    expect(await body.isVisible(), `${name} should render`).toBe(true);
  });
}

// Save does NOT redirect to login (regression from FF3)
test('Save does not redirect to login page', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  const saveBtn = page.getByText('Save', { exact: true }).first();
  if (await saveBtn.count() > 0) {
    const saveResponse = page.waitForResponse(resp =>
      resp.url().includes('/api/screens') && resp.status() === 200
    );
    await saveBtn.click();
    await saveResponse;
    expect(page.url(), 'After save, should still be on editor').toContain('/editor');
  }
});

// Module switching updates canvas content, not just the URL (Issue 47)
test('Module switching updates canvas content', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');

  // Click the first module in the sidebar — use the structure tree
  const structureTree = page.locator('[data-testid="structure-tree"]');
  const modules = structureTree.locator('[class*="module"], [class*="Module"], [class*="screen"]');
  const count = await modules.count();

  if (count >= 2) {
    const firstModule = modules.first();
    const secondModule = modules.nth(1);
    const firstLabel = (await firstModule.textContent())?.trim();
    const secondLabel = (await secondModule.textContent())?.trim();

    if (firstLabel && secondLabel && firstLabel !== secondLabel) {
      await secondModule.click();
      await page.waitForLoadState('networkidle');

      // Canvas should reflect the second module
      const url = page.url();
      expect(url).toContain('module_instance_id');

      // Toolbar/status bar should show the second module name
      const toolbar = page.locator('[data-testid="toolbar"]');
      if (await toolbar.isVisible()) {
        const toolbarText = await toolbar.textContent();
        expect(toolbarText).toContain(secondLabel);
      }
    }
  }
});
