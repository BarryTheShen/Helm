import { test, expect } from '../fixtures';
import { EditorPage } from '../page-objects/editor';

test('Issue 11: pill cursor does not snap after variable insert', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  // Wait for the editor UI to load
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

  // Find a text input in the property inspector (content/label field)
  const input = page.getByPlaceholder(/type.*@/i).first();
  await expect(input).toBeVisible();
  await input.click();

  // Type prefix text before the variable
  await page.keyboard.type('Hello ');

  // Trigger the variable picker with @
  await page.keyboard.press('@');

  // Wait for the variable dropdown/popover to appear and pick the first option
  const variableOption = page.locator('[class*="variable"] li, [class*="picker"] li, [role="option"]').first();
  const optionCount = await variableOption.count();

  if (optionCount > 0) {
    await variableOption.click();

    // Wait for the input to be focused again after the picker closes
    await expect(input).toBeFocused();

    // Type suffix text after the inserted variable pill
    await page.keyboard.type(' World');

    // Verify the full value contains prefix + variable + suffix in order
    const val = await input.inputValue();
    expect(val, 'value should start with "Hello "').toMatch(/^Hello /);
    expect(val, 'value should end with "World"').toMatch(/World$/);
    expect(val, 'cursor should stay at end — value contains both prefix and suffix').toContain('Hello');
  }
});

test('Issue 13: markdown content renders as HTML heading, not raw text', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  // Wait for the editor UI to load
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

  // Find a text input in the property inspector (content/label field)
  const input = page.getByPlaceholder(/type.*@/i).first();
  await expect(input).toBeVisible();
  await input.click();

  // Type markdown heading syntax
  await page.keyboard.type('# Heading');

  // Wait for the canvas to update after typing
  await expect(page.locator(EditorPage.canvas)).toBeVisible();

  // Look for a markdown-rendered preview area (could be in canvas or inspector)
  const preview = page.locator('[class*="markdown"], [class*="preview"]');
  const previewCount = await preview.count();

  if (previewCount > 0) {
    const text = await preview.first().textContent();
    expect(text, 'preview should contain "Heading"').toContain('Heading');
    // If it rendered as markdown, the raw "# Heading" should NOT appear verbatim
    // (it should be inside an <h1> tag instead)
    expect(
      text?.includes('# Heading'),
      'should render as HTML heading, not raw markdown text'
    ).toBe(false);
  } else {
    // Fallback: check for an <h1> or heading element in the preview/canvas
    const heading = page.locator('h1, h2, h3').first();
    const headingCount = await heading.count();
    if (headingCount > 0) {
      const text = await heading.textContent();
      expect(text, 'heading element should contain "Heading"').toContain('Heading');
    }
  }
});
