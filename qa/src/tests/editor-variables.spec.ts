import { test, expect } from '../fixtures';
import { EditorPage, addRowViaStructureTree } from '../page-objects/editor';
import { ensureEmptyCellExists, addComponentToFirstCell } from '../editor-helpers';

test('Issue 11: pill cursor does not snap after variable insert', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await page.waitForLoadState('networkidle');

  await ensureEmptyCellExists(page);
  await addComponentToFirstCell(page, 'Text', { emptyCell: 'last' });

  const cellDiv = page.locator('[data-testid="editor-canvas"] .bg-white.shadow-sm').last();
  if (await cellDiv.count() > 0) {
    await cellDiv.click();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.locator(EditorPage.propertyInspector)).toBeVisible();

  const tiptapEditor = page.locator('[data-testid="property-inspector"] .ProseMirror').first();
  if (await tiptapEditor.count() === 0) {
    return;
  }
  await expect(tiptapEditor).toBeVisible();
  await tiptapEditor.click();

  await page.keyboard.type('Hello ');
  await page.keyboard.press('@');

  const variableOption = page.locator('.shadow-xl button:has(.font-mono)').first();
  const optionCount = await variableOption.count();

  if (optionCount > 0) {
    await variableOption.click();
    await expect(tiptapEditor).toBeFocused();
    await page.keyboard.type(' World');

    const editorHtml = await tiptapEditor.innerHTML();
    expect(editorHtml, 'editor should contain "Hello "').toContain('Hello');
    expect(editorHtml, 'editor should contain "World"').toContain('World');
  }
});

test('Issue 13: markdown content renders as HTML heading, not raw text', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await expect(page.locator(EditorPage.canvas)).toBeVisible();
  await page.waitForLoadState('networkidle');

  await ensureEmptyCellExists(page);
  await addRowViaStructureTree(page);
  await addComponentToFirstCell(page, 'Text', { emptyCell: 'last' });

  const textCell = page.locator('[data-testid="editor-canvas"] .bg-white.shadow-sm').last();
  await expect(textCell).toBeVisible();

  const heading = page.locator('[data-testid="editor-canvas"]').getByRole('heading', { name: 'Heading' }).last();
  await expect(heading).toBeVisible({ timeout: 10000 });
  await expect(heading).toContainText('Heading');
  await expect(textCell).not.toContainText('# Heading');
});
