import { test, expect } from '../fixtures';

test.describe('Component Picker', () => {
  test('getAuthorableComponents returns valid set without duplicates', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { getAuthorableComponents, COMPONENT_REGISTRY } = await import('/src/editor/types.ts');
      const authorable = getAuthorableComponents();
      const types = authorable.map((c: { type: string }) => c.type);
      const hasContainer = authorable.some((c: { type: string }) => c.type === 'Container');
      return {
        total: COMPONENT_REGISTRY.length,
        authorableCount: authorable.length,
        hasContainer,
        types,
        uniqueCount: new Set(types).size,
      };
    });

    expect(result.hasContainer).toBe(false);
    expect(result.uniqueCount).toBe(result.authorableCount);
    expect(result.authorableCount).toBeGreaterThan(0);
  });

  test('COMPONENT_REGISTRY has entries for all authorable types', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { getAuthorableComponents, COMPONENT_REGISTRY } = await import('/src/editor/types.ts');
      const authorable = getAuthorableComponents();
      const registryTypes = new Set(COMPONENT_REGISTRY.map((c: { type: string }) => c.type));
      const missing = authorable.filter((a: { type: string }) => !registryTypes.has(a.type)).map((a: { type: string }) => a.type);
      return { missingCount: missing.length, missing };
    });

    expect(result.missingCount).toBe(0);
  });
});
