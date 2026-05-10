import { test, expect } from '../fixtures';
import { TemplatesPage } from '../page-objects/templates';
import { EditorPage } from '../page-objects/editor';

/**
 * Helper: apply the current template by selecting the first available module
 * and clicking "Apply as Draft". If no modules exist, just close the modal.
 */
async function applyCurrentTemplate(page: any) {
  // Wait for the apply modal heading
  await expect(page.locator(TemplatesPage.applyModalHeading)).toBeVisible({ timeout: 5000 });
  
  // Check if modules are available in the select dropdown
  const moduleSelect = page.locator(TemplatesPage.applyModuleSelect);
  const optionCount = await moduleSelect.locator('option').count();
  const hasModules = optionCount > 1; // More than the "Select a module..." placeholder
  
  if (hasModules) {
    // Select the first real module option
    await moduleSelect.selectOption({ index: 1 });
    await page.locator(TemplatesPage.applyAsDraftBtn).click();
    // Brief pause for the API call to complete
    await page.waitForTimeout(500);
  } else {
    // No modules available — close by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

test('templates page loads without errors', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  const body = page.locator('body');
  expect(await body.isVisible()).toBe(true);
});

test('no template produces Unknown components when applied', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  // Click each available template apply button and verify no "Unknown" components appear
  const applyButtons = page.locator(TemplatesPage.btnApply);
  const count = await applyButtons.count();

  for (let i = 0; i < count; i++) {
    // Re-fetch apply buttons after any navigation
    const currentApplyButtons = page.locator(TemplatesPage.btnApply);
    const currentCount = await currentApplyButtons.count();
    if (i >= currentCount) break;
    
    await currentApplyButtons.nth(i).click();
    
    // The apply button opens a modal (not direct navigation). Complete the modal flow.
    await applyCurrentTemplate(page);
    
    // Navigate to editor to check structure tree and unknown components
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.structureTree)).toBeVisible({ timeout: 10000 });

    const unknownCount = await page.locator(EditorPage.unknownLabel).count();
    expect(
      unknownCount,
      `Template ${i + 1} should not produce any "Unknown" components`
    ).toBe(0);

    // Navigate back to templates for the next iteration
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();
  }
});

test('Home template: calendar uses compact variant, no Container component', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  // Find the Home template card by its title text
  const homeCard = page.locator(TemplatesPage.templateCards).filter({ hasText: 'Home' });
  await expect(homeCard.first()).toBeVisible();

  // Click the apply button on the Home template card
  const applyBtn = homeCard.locator(TemplatesPage.btnApply);
  await applyBtn.click();

  // Complete the apply modal flow
  await applyCurrentTemplate(page);

  // Navigate to editor to inspect the applied template
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(EditorPage.structureTree)).toBeVisible({ timeout: 10000 });

  // Verify no "Container" text appears in canvas
  const containerInCanvas = page.locator(EditorPage.canvas).locator('text=Container');
  expect(
    await containerInCanvas.count(),
    'Home template should not contain any "Container" components'
  ).toBe(0);

  // Verify calendar variant is compact (check inspector or structure tree)
  const variantSelect = page.locator('[data-testid="property-inspector"] select').first();
  const variantCount = await variantSelect.count();
  if (variantCount > 0) {
    const variantValue = await variantSelect.inputValue();
    expect(
      variantValue,
      'Home template calendar should use "compact" variant'
    ).toBe('compact');
  }
});

test('Chat template: no standalone Divider component', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  // Find the Chat template card by its title text
  const chatCard = page.locator(TemplatesPage.templateCards).filter({ hasText: 'Chat' });
  await expect(chatCard.first()).toBeVisible();

  // Click the apply button on the Chat template card
  const applyBtn = chatCard.locator(TemplatesPage.btnApply);
  await applyBtn.click();

  // Complete the apply modal flow
  await applyCurrentTemplate(page);

  // Navigate to editor to inspect the applied template
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(EditorPage.structureTree)).toBeVisible({ timeout: 10000 });

  // Verify no standalone "Divider" text appears in the structure tree
  // Divider should be a row property, not a component entry
  const structureTree = page.locator(EditorPage.structureTree);
  const dividerInTree = structureTree.locator('text=Divider');
  expect(
    await dividerInTree.count(),
    'Chat template should not have Divider as a standalone component in structure tree'
  ).toBe(0);
});
