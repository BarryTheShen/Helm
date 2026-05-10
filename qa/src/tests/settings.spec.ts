import { test, expect } from '../fixtures';

test.describe('Settings Page (Device Management)', () => {

  test('loads and displays settings page', async ({ page, login }) => {
    await login();
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // The settings page is titled "Device Management"
    // Note: there are two h1 elements (nav header + page heading), target by text
    await expect(page.getByRole('heading', { name: 'Device Management' })).toBeVisible();

    // Description should be present
    await expect(page.getByText('Manage registered devices')).toBeVisible();
  });

  test('handles empty state or shows device table', async ({ page, login }) => {
    await login();
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish
    await page.waitForTimeout(500);

    // After loading, either:
    // 1. No devices — shows empty state with "No devices registered"
    // 2. Has devices — shows a table with device rows
    const emptyState = page.getByText('No devices registered');
    const deviceTable = page.locator('table');

    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const tableVisible = await deviceTable.isVisible().catch(() => false);

    expect(emptyVisible || tableVisible,
      'Should show either "No devices registered" empty state or a device table'
    ).toBe(true);

    if (tableVisible) {
      // Verify table has expected columns
      const headers = await deviceTable.locator('thead th').allTextContents();
      const headerText = headers.join(' ');
      expect(headerText).toContain('Device');
      expect(headerText).toContain('App');
      expect(headerText).toContain('Last Seen');
    }
  });

  test('page can be reloaded without errors', async ({ page, login }) => {
    await login();
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Reload and verify page still renders
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Note: there are two h1 elements (nav header + page heading), target by text
    await expect(page.getByRole('heading', { name: 'Device Management' })).toBeVisible();
  });

});
