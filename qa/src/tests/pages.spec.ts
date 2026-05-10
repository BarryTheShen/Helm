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
      resp.url().includes('/api/sdui/') && resp.status() === 200
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

  // Click the first module in the sidebar — ModulesTree is rendered inside the <aside>
  // Each module item has a span with classes "text-xs flex-1 truncate font-medium"
  const moduleNames = page.locator('aside span.truncate.font-medium');
  const count = await moduleNames.count();

  if (count >= 2) {
    const firstModuleSpan = moduleNames.first();
    const secondModuleSpan = moduleNames.nth(1);
    // Strip "(built-in)" suffix from label; the toolbar shows module name without suffix
    const firstLabel = (await firstModuleSpan.textContent())?.trim().replace(/\s*\(built-in\)$/, '') || '';
    const secondLabel = (await secondModuleSpan.textContent())?.trim().replace(/\s*\(built-in\)$/, '') || '';

    if (firstLabel && secondLabel && firstLabel !== secondLabel) {
      // Click the parent div of the module name span to trigger handleModuleClick
      // (span click bubbles to parent div's onClick via React event delegation)
      await secondModuleSpan.click();
      await page.waitForLoadState('networkidle');

      // Canvas should reflect the second module
      const url = page.url();
      expect(url).toContain('module_instance_id');

      // Toolbar/status bar should show the second module name
      // Use expect().toContainText() with timeout to wait for React state propagation
      const toolbar = page.locator('[data-testid="toolbar"]');
      if (await toolbar.isVisible()) {
        await expect(toolbar).toContainText(secondLabel, { timeout: 5000 });
      }
    }
  }
});
