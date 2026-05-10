import { test, expect } from '../fixtures';

test.describe('Logs Page', () => {

  test('loads and displays log page', async ({ page, login }) => {
    await login();
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Main heading should be visible
    const heading = page.locator('h2');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Logs');

    // Both tabs should be visible
    await expect(page.getByText('Sessions').first()).toBeVisible();
    await expect(page.getByText('Audit Log').first()).toBeVisible();
  });

  test('displays session list or empty state', async ({ page, login }) => {
    await login();
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish
    await page.waitForTimeout(500);

    // Sessions is the default tab - should show either:
    // 1. A table with session rows
    // 2. "No sessions found" empty state
    // 3. A loading spinner

    const loadingSpinner = page.getByText('Loading sessions...');
    const emptyState = page.getByText('No sessions found');
    const sessionTable = page.locator('table');

    const loadingVisible = await loadingSpinner.isVisible().catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const tableVisible = await sessionTable.isVisible().catch(() => false);

    // Wait a bit more if still loading
    if (loadingVisible) {
      await page.waitForTimeout(2000);
    }

    // Re-check after potential loading completion
    const emptyVisible2 = await emptyState.isVisible().catch(() => false);
    const tableVisible2 = await sessionTable.isVisible().catch(() => false);

    expect(emptyVisible2 || tableVisible2,
      'Sessions tab should show either "No sessions found" empty state or a session table'
    ).toBe(true);

    if (tableVisible2) {
      // Verify table has expected columns
      const headers = await sessionTable.locator('thead th').allTextContents();
      const headerText = headers.join(' ');
      expect(headerText).toContain('User');
      expect(headerText).toContain('Device');
      expect(headerText).toContain('Status');
    }
  });

  test('audit log tab shows entries or empty state', async ({ page, login }) => {
    await login();
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Switch to Audit Log tab
    await page.getByText('Audit Log').first().click();
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(500);

    // Audit tab should show either:
    // 1. A table with audit entries
    // 2. "No audit entries found" empty state
    // 3. A loading spinner

    const loadingSpinner = page.getByText('Loading audit entries...');
    const emptyState = page.getByText('No audit entries found');
    const auditTable = page.locator('table');

    const loadingVisible = await loadingSpinner.isVisible().catch(() => false);
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const tableVisible = await auditTable.isVisible().catch(() => false);

    // Wait a bit more if still loading
    if (loadingVisible) {
      await page.waitForTimeout(2000);
    }

    // Re-check after potential loading completion
    const emptyVisible2 = await emptyState.isVisible().catch(() => false);
    const tableVisible2 = await auditTable.isVisible().catch(() => false);

    expect(emptyVisible2 || tableVisible2,
      'Audit Log tab should show either "No audit entries found" empty state or an audit entries table'
    ).toBe(true);

    if (tableVisible2) {
      // Verify table has expected columns
      const headers = await auditTable.locator('thead th').allTextContents();
      const headerText = headers.join(' ');
      expect(headerText).toContain('Action');
      expect(headerText).toContain('Resource');
      expect(headerText).toContain('Time');
    }

    // Verify filter controls are visible
    // Check for date filter inputs (visible), not the select option text (which is hidden)
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

});
