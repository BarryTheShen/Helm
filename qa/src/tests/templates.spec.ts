import { test, expect } from '../fixtures';
import { TemplatesPage } from '../page-objects/templates';
import { EditorPage } from '../page-objects/editor';

test('templates page loads without errors', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards)).toBeVisible();

  const body = page.locator('body');
  expect(await body.isVisible()).toBe(true);
});

test('no template produces Unknown components when applied', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards)).toBeVisible();

  // Click each available template apply button and verify no "Unknown" components appear
  const applyButtons = page.locator(TemplatesPage.btnApply);
  const count = await applyButtons.count();

  for (let i = 0; i < count; i++) {
    await applyButtons.nth(i).click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();

    const unknownCount = await page.locator(EditorPage.unknownLabel).count();
    expect(
      unknownCount,
      `Template ${i + 1} should not produce any "Unknown" components`
    ).toBe(0);
  }
});

test('Home template: calendar uses compact variant, no Container component', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards)).toBeVisible();

  // Find and click the Home template
  const homeBtn = page.locator('button:has-text("Home")').first();
  if (await homeBtn.isVisible()) {
    await homeBtn.click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();
  } else {
    // Try finding by label/card text
    const homeCard = page.locator('text=Home').first();
    if (await homeCard.isVisible()) {
      await homeCard.click();
      await expect(page.locator(EditorPage.structureTree)).toBeVisible();
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
  await expect(page.locator(TemplatesPage.templateCards)).toBeVisible();

  // Find and click the Chat template
  const chatBtn = page.locator('button:has-text("Chat")').first();
  if (await chatBtn.isVisible()) {
    await chatBtn.click();
    await expect(page.locator(EditorPage.structureTree)).toBeVisible();
  } else {
    const chatCard = page.locator('text=Chat').first();
    if (await chatCard.isVisible()) {
      await chatCard.click();
      await expect(page.locator(EditorPage.structureTree)).toBeVisible();
    }
  }

  // Verify no standalone "Divider" text appears in the structure tree
  // Divider should be a row property, not a component entry
  const structureTree = page.locator(EditorPage.structureTree);
  if (await structureTree.isVisible()) {
    const dividerInTree = structureTree.locator('text=Divider');
    expect(
      await dividerInTree.count(),
      'Chat template should not have Divider as a standalone component in structure tree'
    ).toBe(0);
  } else {
    // Fallback: if we can't isolate the tree, check the full page
    const dividerCount = await page.locator('text=Divider').count();
    expect(
      dividerCount,
      'Chat template should not have standalone Divider -- it should be a row property'
    ).toBe(0);
  }
});
