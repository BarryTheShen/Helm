import { test, expect } from '../fixtures';

/**
 * FF4 Phase 3 — App Editor preview smoke (FF4-APP-014, FF4-QA-005).
 */
test('App Editor browser preview shows phone shell with bottom bar', async ({ page, login }) => {
  await login();
  await page.goto('/app-editor');
  await page.waitForLoadState('networkidle');

  const previewButton = page.getByRole('button', { name: /preview/i }).first();
  await expect(previewButton).toBeVisible();
  await previewButton.click();

  const browserPreviewOption = page.getByRole('button', { name: 'Browser Preview' });
  await expect(browserPreviewOption).toBeVisible();
  await browserPreviewOption.click();

  const modal = page.getByTestId('browser-preview-modal');
  await expect(modal).toBeVisible({ timeout: 15000 });

  await expect(modal.getByTestId('app-phone-shell')).toBeVisible();
  await expect(modal.getByTestId('app-phone-bottom-bar')).toBeVisible();
});

test('App Editor inline phone mockup renders shell', async ({ page, login }) => {
  await login();
  await page.goto('/app-editor');
  await page.waitForLoadState('networkidle');

  const phoneShell = page.getByTestId('app-phone-shell');
  const emptyState = page.getByText('No modules configured');

  await expect(phoneShell.or(emptyState)).toBeVisible({ timeout: 10000 });
});

test('Module Editor preview modal renders SDUI rows', async ({ page, login }) => {
  await login();
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');

  const moduleNames = page.locator('aside span.truncate.font-medium');
  if (await moduleNames.count() === 0) {
    test.skip();
    return;
  }

  await moduleNames.first().click();
  await page.waitForLoadState('networkidle');

  const previewButton = page.getByRole('button', { name: /^Preview$/i }).first();
  if (!(await previewButton.isVisible())) {
    test.skip();
    return;
  }

  await previewButton.click();

  const previewPanel = page.getByTestId('module-editor-preview');
  await expect(previewPanel).toBeVisible({ timeout: 10000 });

  const embeddedPreview = previewPanel.getByTestId('sdui-preview-embedded');
  const emptyPreview = previewPanel.getByText('No content to preview');

  await expect(embeddedPreview.or(emptyPreview)).toBeVisible();
});
