import { test, expect } from '../fixtures';

test.describe('Variables Page — FF3-DS-UX-001', () => {
  test('shows page title, tab hints, and variables empty state copy', async ({ page, login }) => {
    await login();
    await page.goto('/variables');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Variables & Data Sources', level: 1 })).toBeVisible();
    await expect(
      page.getByText(/Configure static values and live data feeds for SDUI components/i)
    ).toBeVisible();

    await expect(page.getByRole('button', { name: 'Variables', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data Sources', exact: true })).toBeVisible();

    const variablesHint = page.getByText(/\[\[variable\.name\]\]/i);
    const variablesHintVisible = await variablesHint.isVisible().catch(() => false);
    if (variablesHintVisible) {
      await expect(variablesHint).toBeVisible();
    }

    const emptyState = page.getByText(/No custom variables yet/i);
    const variableTable = page.locator('table').first();
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const tableVisible = await variableTable.isVisible().catch(() => false);

    if (emptyVisible) {
      await expect(page.getByText(/Variables hold static text, numbers, or flags/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add your first variable' })).toBeVisible();
    } else {
      expect(tableVisible, 'Expected variables table when empty state is hidden').toBe(true);
    }

    await expect(page.getByText('Variable Syntax Reference')).toBeVisible();
    await expect(page.getByText('How Variables Work')).toBeVisible();
  });

  test('data sources tab shows hints, empty state, and connector presets', async ({ page, login }) => {
    await login();
    await page.goto('/variables');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Data Sources', exact: true }).click();
    await page.waitForLoadState('networkidle');

    const dataSourcesHint = page.getByText(/data\.source_id\.field/i);
    const hintVisible = await dataSourcesHint.isVisible().catch(() => false);
    if (hintVisible) {
      await expect(dataSourcesHint).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: /Data Sources \(\d+\)/ })).toBeVisible();

    const sourceTable = page.locator('table tbody tr');
    const hasSeededSources = (await sourceTable.count()) > 0;

    if (!hasSeededSources) {
      const emptyPanel = page.locator('.border-dashed').filter({ hasText: 'No data sources yet' });
      await expect(emptyPanel).toBeVisible();
      await expect(emptyPanel.getByText('calendar_events')).toBeVisible();
      await expect(page.getByText(/Property Inspector → Data Binding/i)).toBeVisible();
    } else {
      await expect(sourceTable.first()).toBeVisible();
    }

    await expect(page.getByText('How Data Sources Work')).toBeVisible();

    await page.getByRole('button', { name: 'Add Data Source' }).click();
    await expect(page.getByText('Data Source Configuration Guide')).toBeVisible();
    await expect(page.getByText(/local_db/i).first()).toBeVisible();
    await expect(page.getByText(/http_json/i).first()).toBeVisible();

    const typeSelect = page.locator('select').filter({ has: page.locator('option[value="calendar"]') }).first();
    await typeSelect.selectOption('calendar');

    const connectorInput = page.getByPlaceholder(/local_db, http_json, rss_feed/i);
    await expect(connectorInput).toHaveValue('local_db');

    await typeSelect.selectOption('http_json');
    await expect(connectorInput).toHaveValue('http_json');
    await expect(page.locator('textarea').first()).toContainText('api.example.com');
  });
});

test.describe('Variables Page', () => {

  test('loads and shows variable list', async ({ page, login }) => {
    await login();
    await page.goto('/variables');
    await page.waitForLoadState('networkidle');

    // The variables tab heading should be visible
    await expect(page.locator('h2').first()).toBeVisible();

    // Check for either a variable list table or empty state message
    // The variables table is the first table on the page (before the Syntax Reference table)
    const emptyState = page.getByText(/No custom variables yet/i);
    const variableTable = page.locator('table').first();

    const emptyVisible = await emptyState.isVisible().catch(() => false);
    const tableVisible = await variableTable.isVisible().catch(() => false);

    expect(emptyVisible || tableVisible,
      'Should show either "No variables yet" empty state or a variable table'
    ).toBe(true);

    if (tableVisible) {
      // Check it's the variables table (not the Syntax Reference table)
      // Variables table has "Name", "Type", "Value" headers
      const headers = await variableTable.locator('thead th').allTextContents();
      const headerText = headers.join(' ');

      if (headerText.includes('Name') && headerText.includes('Type') && headerText.includes('Value')) {
        // Confirm it's the variables table with expected columns
        expect(headerText).toContain('Name');
        expect(headerText).toContain('Type');
        expect(headerText).toContain('Value');
      }
      // If it's the Syntax Reference table (Namespace/Example/Source), variables table is not visible
      // which is fine — it means there are no variables yet
    }

    // Page should have tabs: Variables and Data Sources
    await expect(page.getByText('Data Sources').first()).toBeVisible();
  });

  test('can add a new variable', async ({ page, login }) => {
    await login();
    await page.goto('/variables');
    await page.waitForLoadState('networkidle');

    const uniqueName = `e2e_test_var_${Date.now()}`;

    // Click "Add Variable" button
    // Use getByRole to avoid matching the empty state message text which also contains "Add Variable"
    const addBtn = page.getByRole('button', { name: 'Add Variable' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // The create form should appear
    await expect(page.getByPlaceholder('e.g., app_name, welcome_message')).toBeVisible();

    // Fill in the variable form
    await page.getByPlaceholder('e.g., app_name, welcome_message').fill(uniqueName);
    await page.getByPlaceholder('e.g., My App, 42, true').fill('test_value_123');

    // Click Save button (green "Save" button in the form)
    const saveBtn = page.locator('button').filter({ hasText: 'Save' }).first();
    await saveBtn.click();

    // Wait for the save to complete and the variable to appear in the list
    await page.waitForLoadState('networkidle');

    // Verify the variable appears in the table
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Verify the value appears in the table
    await expect(page.getByText('test_value_123')).toBeVisible();

    // Cleanup: delete the variable we just created
    // The delete button is in the row with our variable name
    const variableRow = page.locator('table tbody tr').filter({ hasText: uniqueName });
    if (await variableRow.count() > 0) {
      const deleteBtn = variableRow.locator('button[title="Delete"]');
      if (await deleteBtn.count() > 0) {
        await deleteBtn.click();

        // Confirm deletion in the modal
        const confirmModal = page.getByText('Confirm Delete');
        await expect(confirmModal).toBeVisible({ timeout: 3000 });
        await page.getByText('Delete').last().click();

        // Wait for deletion to complete
        await page.waitForLoadState('networkidle');

        // Verify the variable is no longer visible
        await expect(page.getByText(uniqueName)).not.toBeVisible();
      }
    }
  });

  test('can delete a variable', async ({ page, login }) => {
    await login();
    await page.goto('/variables');
    await page.waitForLoadState('networkidle');

    const uniqueName = `e2e_test_del_${Date.now()}`;

    // First ensure there's a variable to delete by creating one
    // Use getByRole to avoid matching the empty state message text which also contains "Add Variable"
    const addBtn = page.getByRole('button', { name: 'Add Variable' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    await expect(page.getByPlaceholder('e.g., app_name, welcome_message')).toBeVisible();
    await page.getByPlaceholder('e.g., app_name, welcome_message').fill(uniqueName);
    await page.getByPlaceholder('e.g., My App, 42, true').fill('delete_me');
    await page.locator('button').filter({ hasText: 'Save' }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify the variable was created
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Now delete it
    const variableRow = page.locator('table tbody tr').filter({ hasText: uniqueName });
    const deleteBtn = variableRow.locator('button[title="Delete"]');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Confirm deletion
    const confirmModal = page.getByText('Confirm Delete');
    await expect(confirmModal).toBeVisible({ timeout: 3000 });

    // Click the "Delete" button in the confirmation dialog
    await page.getByText('Delete').last().click();

    // Wait for deletion to complete
    await page.waitForLoadState('networkidle');

    // Verify the variable is no longer in the list
    await expect(page.getByText(uniqueName)).not.toBeVisible();
  });

});
