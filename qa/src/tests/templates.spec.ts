import { test, expect } from '../fixtures';

test('templates page loads without errors', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await page.waitForTimeout(2000);

  const body = page.locator('body');
  expect(await body.isVisible()).toBe(true);
});

test('no template produces Unknown components when applied', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await page.waitForTimeout(2000);

  // Click each available template and verify no "Unknown" components appear
  const applyButtons = page.locator('button:has-text("Apply"), button:has-text("Use"), button:has-text("Load")');
  const count = await applyButtons.count();

  for (let i = 0; i < count; i++) {
    await applyButtons.nth(i).click();
    await page.waitForTimeout(1500);

    const unknownCount = await page.locator('text=Unknown').count();
    expect(
      unknownCount,
      `Template ${i + 1} should not produce any "Unknown" components`
    ).toBe(0);
  }
});

test('Home template: calendar uses compact variant, no Container component', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await page.waitForTimeout(2000);

  // Find and click the Home template
  const homeBtn = page.locator('button:has-text("Home")').first();
  if (await homeBtn.count() > 0) {
    await homeBtn.click();
    await page.waitForTimeout(1500);
  } else {
    // Try finding by label/card text
    const homeCard = page.locator('text=Home').first();
    if (await homeCard.count() > 0) {
      await homeCard.click();
      await page.waitForTimeout(1500);
    }
  }

  // Verify no "Container" text appears in canvas
  const containerCount = await page.locator('text=Container').count();
  expect(
    containerCount,
    'Home template should not contain any "Container" components'
  ).toBe(0);

  // Verify calendar variant is compact (check inspector or structure tree)
  const variantSelect = page.locator('select').first();
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
  await page.waitForTimeout(2000);

  // Find and click the Chat template
  const chatBtn = page.locator('button:has-text("Chat")').first();
  if (await chatBtn.count() > 0) {
    await chatBtn.click();
    await page.waitForTimeout(1500);
  } else {
    const chatCard = page.locator('text=Chat').first();
    if (await chatCard.count() > 0) {
      await chatCard.click();
      await page.waitForTimeout(1500);
    }
  }

  // Verify no standalone "Divider" text appears in the structure tree
  // Divider should be a row property, not a component entry
  const dividerComponent = page.locator('text=Divider').first();
  const dividerCount = await dividerComponent.count();

  // If "Divider" appears, it should only be in the context of row properties (inspector),
  // not as a standalone component in the structure tree
  const structureTree = page.locator('.tree, [class*="structure"], [class*="tree"]').first();
  if (await structureTree.count() > 0) {
    const dividerInTree = structureTree.locator('text=Divider');
    expect(
      await dividerInTree.count(),
      'Chat template should not have Divider as a standalone component in structure tree'
    ).toBe(0);
  } else if (dividerCount > 0) {
    // Fallback: if we can't isolate the tree, at least check the canvas
    // Divider should not appear as a rendered component
    expect(
      dividerCount,
      'Chat template should not have standalone Divider — it should be a row property'
    ).toBe(0);
  }
});

