import { test, expect } from '../fixtures';

test.describe('Edge Case Data', () => {
  test('normalization handles empty strings', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { normalizeComponentForEditor } = await import('/src/editor/types.ts');
      return normalizeComponentForEditor({ type: 'Text', props: { content: '' } });
    });
    expect(result).toBeTruthy();
  });

  test('normalization handles very long text', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { normalizeComponentForEditor } = await import('/src/editor/types.ts');
      return normalizeComponentForEditor({ type: 'Text', props: { content: 'x'.repeat(10000) } });
    });
    expect(result).toBeTruthy();
  });

  test('normalization handles unicode emoji', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { normalizeComponentForEditor } = await import('/src/editor/types.ts');
      return normalizeComponentForEditor({ type: 'Text', props: { content: 'Hello \u{1F600}\u{1F389}' } });
    });
    expect(result).toBeTruthy();
  });

  test('normalization handles null props', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { normalizeComponentForEditor } = await import('/src/editor/types.ts');
      try {
        const n = normalizeComponentForEditor({ type: 'Text', props: { content: null as any } });
        return { success: true, result: n ? 'normalized' : 'null' };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    });
    // Should not crash — either returns normalized result or handles gracefully
    expect(result.success).toBe(true);
  });

  test('normalization handles negative numbers', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { normalizeComponentForEditor } = await import('/src/editor/types.ts');
      return normalizeComponentForEditor({ type: 'Text', props: { content: String(-999) } });
    });
    expect(result).toBeTruthy();
  });
});
