import { test, expect } from '../fixtures';
import { TemplatesPage } from '../page-objects/templates';
import { EditorPage } from '../page-objects/editor';

/**
 * Helper: extract all component type strings from a V2 screen JSON.
 * Walks cells[].content recursively and returns unique type values.
 * Row-level types (row.type) are NOT included.
 */
function collectModuleStateTypes(screen: unknown): string[] {
  if (!screen || typeof screen !== 'object') return [];
  const types = new Set<string>();
  const rows = (screen as Record<string, unknown>).rows;
  if (!Array.isArray(rows)) return [];

  function walkContent(content: unknown): void {
    if (!content || typeof content !== 'object') return;
    const comp = content as Record<string, unknown>;
    if (typeof comp.type === 'string' && comp.type.length > 0) {
      types.add(comp.type);
    }
    // Recurse into children
    const children = comp.children;
    if (Array.isArray(children)) {
      for (const child of children) walkContent(child);
    }
    // Recurse into props.children (SDUI V2 Container pattern)
    const props = comp.props;
    if (props && typeof props === 'object') {
      const propsChildren = (props as Record<string, unknown>).children;
      if (Array.isArray(propsChildren)) {
        for (const child of propsChildren) walkContent(child);
      }
    }
  }

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const cells = (row as Record<string, unknown>).cells;
    if (!Array.isArray(cells)) continue;
    for (const cell of cells) {
      if (!cell || typeof cell !== 'object') continue;
      walkContent((cell as Record<string, unknown>).content);
    }
  }

  return [...types];
}

/**
 * Helper: apply the current template by selecting the first available module
 * and clicking "Apply as Draft". If no modules exist, just close the modal.
 */
async function applyCurrentTemplate(page: any) {
  // Wait for the apply modal heading
  await expect(page.locator(TemplatesPage.applyModalHeading)).toBeVisible({ timeout: 5000 });
  
  // Check if modules are available in the select dropdown
  const moduleSelect = page.locator(TemplatesPage.applyModuleSelect);
  const optionCount = await moduleSelect.locator('option').count();
  const hasModules = optionCount > 1; // More than the "Select a module..." placeholder
  
  if (hasModules) {
    // Select the first real module option
    await moduleSelect.selectOption({ index: 1 });
    await page.locator(TemplatesPage.applyAsDraftBtn).click();
    // Brief pause for the API call to complete
    await page.waitForTimeout(500);
  } else {
    // No modules available — close by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

test('templates page loads without errors', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  const body = page.locator('body');
  expect(await body.isVisible()).toBe(true);
});

test('no template produces Unknown components when applied', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  // Click each available template apply button and verify no "Unknown" components appear
  const applyButtons = page.locator(TemplatesPage.btnApply);
  const count = await applyButtons.count();

  for (let i = 0; i < count; i++) {
    // Re-fetch apply buttons after any navigation
    const currentApplyButtons = page.locator(TemplatesPage.btnApply);
    const currentCount = await currentApplyButtons.count();
    if (i >= currentCount) break;
    
    await currentApplyButtons.nth(i).click();
    
    // The apply button opens a modal (not direct navigation). Complete the modal flow.
    await applyCurrentTemplate(page);
    
    // Navigate to editor to check structure tree and unknown components
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(EditorPage.structureTree)).toBeVisible({ timeout: 10000 });

    const unknownCount = await page.locator(EditorPage.unknownLabel).count();
    expect(
      unknownCount,
      `Template ${i + 1} should not produce any "Unknown" components`
    ).toBe(0);

    // Navigate back to templates for the next iteration
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();
  }
});

test('Home template: calendar uses compact variant, no Container component', async ({ page, login }) => {
  await login();
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  // Find the Home template card by its title text
  const homeCard = page.locator(TemplatesPage.templateCards).filter({ hasText: 'Home' });
  await expect(homeCard.first()).toBeVisible();

  // Click the apply button on the Home template card
  const applyBtn = homeCard.locator(TemplatesPage.btnApply);
  await applyBtn.click();

  // Complete the apply modal flow
  await applyCurrentTemplate(page);

  // Navigate to editor to inspect the applied template
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(EditorPage.structureTree)).toBeVisible({ timeout: 10000 });

  // Verify no "Container" text appears in canvas
  const containerInCanvas = page.locator(EditorPage.canvas).locator('text=Container');
  expect(
    await containerInCanvas.count(),
    'Home template should not contain any "Container" components'
  ).toBe(0);

  // Verify calendar variant is compact (check inspector or structure tree)
  const variantSelect = page.locator('[data-testid="property-inspector"] select').first();
  const variantCount = await variantSelect.count();
  if (variantCount > 0) {
    const variantValue = await variantSelect.inputValue();
    expect(
      variantValue,
      'Home template calendar should use "compact" variant'
    ).toBe('compact');
  }
});

test('Chat template: no standalone Divider component', async ({ page, login, request }) => {
  await login();

  // Navigate to templates page first (needed to access localStorage)
  await page.goto('/templates');
  await expect(page.locator(TemplatesPage.templateCards).first()).toBeVisible();

  // ── Step 1: Check existing Chat module state before applying template ──
  // Get the auth token from localStorage (page must be loaded first)
  const token = await page.evaluate(() => window.localStorage.getItem('admin_token'));
  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Check live screen (uses baseURL which proxies to backend)
  const liveResp = await request.get('/api/sdui/chat', { headers: authHeaders });
  if (liveResp.ok()) {
    const liveData = await liveResp.json();
    if (liveData.screen) {
      const liveTypes = collectModuleStateTypes(liveData.screen);
      const liveDivider = liveTypes.filter(t => t === 'Divider');
      expect(
        liveDivider,
        `Chat module live state should not contain Divider components. Found: ${liveDivider.join(', ')}`
      ).toEqual([]);
    }
  }

  // Check draft screen
  const draftResp = await request.get('/api/sdui/chat/draft', { headers: authHeaders });
  if (draftResp.ok()) {
    const draftData = await draftResp.json();
    if (draftData.has_draft && draftData.screen) {
      const draftTypes = collectModuleStateTypes(draftData.screen);
      const draftDivider = draftTypes.filter(t => t === 'Divider');
      expect(
        draftDivider,
        `Chat module draft state should not contain Divider components. Found: ${draftDivider.join(', ')}`
      ).toEqual([]);
    }
  }

  // ── Step 2: Apply the Chat template ──
  // Note: we're already on the templates page, find the Chat template card
  const chatCard = page.locator(TemplatesPage.templateCards).filter({ hasText: 'Chat' });
  await expect(chatCard.first()).toBeVisible();

  // Click the apply button on the Chat template card
  const applyBtn = chatCard.locator(TemplatesPage.btnApply);
  await applyBtn.click();

  // Complete the apply modal flow
  await applyCurrentTemplate(page);

  // Navigate to editor to inspect the applied template
  await page.goto('/editor');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(EditorPage.structureTree)).toBeVisible({ timeout: 10000 });

  // Verify no standalone "Divider" text appears in the structure tree
  // Divider should be a row property, not a component entry
  const structureTree = page.locator(EditorPage.structureTree);
  const dividerInTree = structureTree.locator('text=Divider');
  expect(
    await dividerInTree.count(),
    'Chat template should not have Divider as a standalone component in structure tree'
  ).toBe(0);
});
