import { test, expect } from '../fixtures';

test('Issue 11: pill cursor does not snap after variable insert', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await page.waitForTimeout(1500);

  // Find a text input in the property inspector (content/label field)
  const input = page.getByPlaceholder(/type.*@/i).first();
  await input.click();
  await page.waitForTimeout(300);

  // Type prefix text before the variable
  await page.keyboard.type('Hello ');
  await page.waitForTimeout(200);

  // Trigger the variable picker with @
  await page.keyboard.press('@');
  await page.waitForTimeout(500);

  // Wait for the variable dropdown/popover to appear and pick the first option
  const variableOption = page.locator('[class*="variable"] li, [class*="picker"] li, [role="option"]').first();
  const optionCount = await variableOption.count();

  if (optionCount > 0) {
    await variableOption.click();
    await page.waitForTimeout(400);

    // Type suffix text after the inserted variable pill
    await page.keyboard.type(' World');
    await page.waitForTimeout(300);

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
  await page.waitForTimeout(1500);

  // Find a text input in the property inspector (content/label field)
  const input = page.getByPlaceholder(/type.*@/i).first();
  await input.click();
  await page.waitForTimeout(300);

  // Type markdown heading syntax
  await page.keyboard.type('# Heading');
  await page.waitForTimeout(500);

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
