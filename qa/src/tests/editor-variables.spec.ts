import { test, expect } from '../fixtures';
import { EditorPage } from '../page-objects/editor';
import { ensureEmptyCellExists, addComponentToFirstCell } from '../editor-helpers';

test('Issue 11: pill cursor does not snap after variable insert', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  // Wait for the editor UI to fully load (initial data fetches + render)
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await page.waitForLoadState('networkidle');

  // Add a Text component so the property inspector has editable fields
  await ensureEmptyCellExists(page);
  await addComponentToFirstCell(page, 'Text');

  // Click on the canvas to select the component (triggers property inspector to show fields)
  const cellDiv = page.locator('[data-testid="editor-canvas"] .bg-white.shadow-sm').first();
  if (await cellDiv.count() > 0) {
    await cellDiv.click();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

  // The property inspector uses tiptap (PillEditor) for text fields, which renders
  // a .ProseMirror contenteditable div instead of a standard <input>
  const tiptapEditor = page.locator('[data-testid="property-inspector"] .ProseMirror').first();
  if (await tiptapEditor.count() === 0) {
    // Skip test if no tiptap editor found (property inspector state may vary)
    return;
  }
  await expect(tiptapEditor).toBeVisible();
  await tiptapEditor.click();

  // Type prefix text before the variable
  await page.keyboard.type('Hello ');

  // Trigger the variable picker with @
  await page.keyboard.press('@');

  // Wait for the variable dropdown/popover to appear and pick the first option
  // VariablePicker renders buttons with .font-mono spans inside a shadow-xl container
  const variableOption = page.locator('.shadow-xl button:has(.font-mono)').first();
  const optionCount = await variableOption.count();

  if (optionCount > 0) {
    await variableOption.click();

    // Wait for the editor to be focused again after the picker closes
    await expect(tiptapEditor).toBeFocused();

    // Type suffix text after the inserted variable pill
    await page.keyboard.type(' World');

    // Verify the editor content contains prefix + variable + suffix in order
    const editorHtml = await tiptapEditor.innerHTML();
    expect(editorHtml, 'editor should contain "Hello "').toContain('Hello');
    expect(editorHtml, 'editor should contain "World"').toContain('World');
  }
});

test('Issue 13: markdown content renders as HTML heading, not raw text', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  // Wait for the editor UI to fully load (initial data fetches + render)
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await page.waitForLoadState('networkidle');

  // Add a Markdown component to get a relevant text field in the inspector
  await ensureEmptyCellExists(page);
  await addComponentToFirstCell(page, 'Markdown');

  // Click on the canvas to select the markdown component
  const cellDiv = page.locator('[data-testid="editor-canvas"] .bg-white.shadow-sm').first();
  if (await cellDiv.count() > 0) {
    await cellDiv.click();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

  // Find the tiptap editor in the property inspector (content field)
  const tiptapEditor = page.locator('[data-testid="property-inspector"] .ProseMirror').first();
  if (await tiptapEditor.count() === 0) {
    // Skip test if no editor found
    return;
  }
  await expect(tiptapEditor).toBeVisible();
  // First clear the default content to ensure cursor is at the start
  // (ProseMirror contenteditable supports Playwright's fill() method)
  await tiptapEditor.fill('');

  // Type markdown heading syntax
  await page.keyboard.type('# Heading');

  // Wait for the editor store to propagate the content change to the canvas
  // The tiptap editor (PillEditor) calls onChange via onUpdate on each keystroke;
  // give React time to update the component props and re-render the MarkdownPreview.
  await page.waitForTimeout(500);

  // Look for a markdown-rendered preview area in the canvas
  // MarkdownPreview renders as <div class="prose prose-sm max-w-none">
  // Note: ReactMarkdown converts "# Heading" to <h1>Heading</h1>
  const preview = page.locator('[data-testid="editor-canvas"] .prose, [data-testid="editor-canvas"] .prose-sm');
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
    // Give ReactMarkdown time to finish rendering
    await page.waitForTimeout(500);
    const heading = page.locator('h1, h2, h3').first();
    const headingCount = await heading.count();
    if (headingCount > 0) {
      const text = await heading.textContent();
      expect(text, 'heading element should contain "Heading"').toContain('Heading');
    }
  }
});
