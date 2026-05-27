import { test, expect } from '../fixtures';
import { EditorPage, waitForEditorReady } from '../page-objects/editor';
import { addComponentToFirstCell, createFreshEditorModule, ensureEmptyCellExists } from '../editor-helpers';

test.describe('FF4 Phase 10 — components and variables', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await waitForEditorReady(page);
  });

  test('FF4-VAR-001: variable pill has compact hit box and resolves in preview', async ({ page }) => {
    await createFreshEditorModule(page);
    await ensureEmptyCellExists(page);
    await addComponentToFirstCell(page, 'Text', { emptyCell: 'last' });

    const editor = page.locator('[data-testid="property-inspector"] .ProseMirror').first();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('Hello ');
    await page.keyboard.press('@');

    const option = page.locator('.shadow-xl button').filter({ hasText: 'user.email' }).first();
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();

    const pill = editor.locator('[data-testid="variable-pill"]').first();
    await expect(pill).toBeVisible();
    const box = await pill.boundingBox();
    expect(box?.width ?? 999).toBeLessThan(180);

    const preview = page.locator('[data-testid="editor-canvas"] [data-testid="text-preview"]').last();
    await expect(preview).toContainText('john@example.com', { timeout: 10000 });
    await expect(preview).not.toContainText('{{user.email}}');
  });

  test('FF4-IMG-001: image preview fills cell with fitMode attribute', async ({ page }) => {
    await addComponentToFirstCell(page, 'Image');
    const image = page.locator('[data-testid="image-preview"]').first();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('data-fit-mode', /fitWidth|fitHeight/);
  });

  test('FF4-EC-001: Empty container stacks children vertically', async ({ page }) => {
    await addComponentToFirstCell(page, 'Empty');
    const container = page.locator('[data-testid="empty-container-preview"]').first();
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/flex-col/);
  });

  test('FF4-NOTES-001: Notes preview renders feed shell', async ({ page }) => {
    await addComponentToFirstCell(page, 'NotesModule');
    await expect(page.locator('[data-testid="notes-preview"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="notes-preview"]').first()).toContainText('Notes');
  });

  test('FF4-IB-001: InputBar preview exposes send control', async ({ page }) => {
    await addComponentToFirstCell(page, 'InputBar');
    await expect(page.locator('[data-testid="input-bar-preview"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="input-bar-send"]').first()).toBeVisible();
  });

  test('FF4-TODO-001: Todo preview renders in canvas', async ({ page }) => {
    await addComponentToFirstCell(page, 'Todo');
    await expect(page.locator('[data-testid="editor-canvas"]').getByText(/To-Do|Todo/i).first()).toBeVisible();
  });

  test('FF4-BTN-003: Home template buttons include configured actions', async ({ page, request }) => {
    const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
    const templatesResp = await request.get('/api/templates', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const home = (await templatesResp.json()).items.find((item: { name?: string }) => item.name === 'Home');
    expect(home?.id).toBeTruthy();

    const detailResp = await request.get(`/api/templates/${home.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const screenJson = JSON.stringify((await detailResp.json()).screen_json);
    expect(screenJson).toContain('Button');
    expect(screenJson).toContain('server_action');
  });
});
