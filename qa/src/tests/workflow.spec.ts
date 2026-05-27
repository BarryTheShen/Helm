import { test, expect } from '../fixtures';
import { WorkflowsPage } from '../page-objects/workflows';
import { deleteWorkflow } from '../test-artifact-cleanup';

test.describe('Workflow issue regressions', () => {
  test.afterEach(async ({ request }) => {
    const workflowId = test.info().annotations.find((a) => a.type === 'workflowId')?.description;
    if (workflowId) {
      await deleteWorkflow(request, workflowId);
    }
  });

  test('Issue 38: dropdown persistence - value survives re-select', async ({ page, login }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/workflows') && resp.request().method() === 'POST' && resp.status() === 201,
    );
    await page.locator(WorkflowsPage.btnNewWorkflow).click();
    await expect(page.locator(WorkflowsPage.createModal)).toBeVisible();
    await page.locator(WorkflowsPage.createNameInput).fill('Test Issue 38');
    await page.locator(WorkflowsPage.createCreateBtn).click();
    const created = await (await createResponse).json() as { id: string };
    test.info().annotations.push({ type: 'workflowId', description: created.id });
    await page.locator(WorkflowsPage.addNodeTrigger).click();
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible();
    await node.click();
    await expect(page.locator(WorkflowsPage.nodeInspector)).toBeVisible();
    const dropdown = page.locator('[data-testid="trigger-type-select"]');
    const count = await dropdown.count();
    if (count > 0) {
      const orig = await dropdown.inputValue();
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        await dropdown.selectOption({ index: 1 });
        await page.locator('body').click();
        await node.click();
        await expect(dropdown).toBeVisible();
        expect(await dropdown.inputValue()).not.toBe(orig);
      }
    }
  });

  test('Issue 39: condition typing keeps all characters', async ({ page, login }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/workflows') && resp.request().method() === 'POST' && resp.status() === 201,
    );
    await page.locator(WorkflowsPage.btnNewWorkflow).click();
    await expect(page.locator(WorkflowsPage.createModal)).toBeVisible();
    await page.locator(WorkflowsPage.createNameInput).fill('Test Issue 39');
    await page.locator(WorkflowsPage.createCreateBtn).click();
    const created = await (await createResponse).json() as { id: string };
    test.info().annotations.push({ type: 'workflowId', description: created.id });
    await page.locator(WorkflowsPage.addNodeCondition).click();
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible();
    await node.click();
    const input = page.locator('[data-testid="condition-input"]');
    await expect(input).toBeVisible();
    await input.pressSequentially('hello world', { delay: 30 });
    const val = await input.inputValue();
    expect(val).toBe('hello world');
    expect(val.length).toBe(11);
  });

  test('FF3-WF-SWITCH-001: switch cases add connection handles', async ({ page, login }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/workflows') && resp.request().method() === 'POST' && resp.status() === 201,
    );
    await page.locator(WorkflowsPage.btnNewWorkflow).click();
    await page.locator(WorkflowsPage.createNameInput).fill('Test Switch');
    await page.locator(WorkflowsPage.createCreateBtn).click();
    const created = await (await createResponse).json() as { id: string };
    test.info().annotations.push({ type: 'workflowId', description: created.id });
    await page.locator(WorkflowsPage.addNodeSwitch).click();
    const node = page.locator('[data-testid="switch-node"]');
    await expect(node).toBeVisible();
    await node.click();
    await expect(page.locator(WorkflowsPage.nodeInspector)).toBeVisible();
    const casesInput = page.locator('[data-testid="switch-cases-input"]');
    await casesInput.fill('success, error');
    await expect(casesInput).toHaveValue('success, error');
    // 2 case handles + 1 default + 1 target
    const handles = node.locator('.react-flow__handle');
    await expect(handles).toHaveCount(4);
  });

  test('FF3-WF-LOOP-001: loop node renders distinct pill shape', async ({ page, login }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/workflows') && resp.request().method() === 'POST' && resp.status() === 201,
    );
    await page.locator(WorkflowsPage.btnNewWorkflow).click();
    await page.locator(WorkflowsPage.createNameInput).fill('Test Loop');
    await page.locator(WorkflowsPage.createCreateBtn).click();
    const created = await (await createResponse).json() as { id: string };
    test.info().annotations.push({ type: 'workflowId', description: created.id });
    await page.locator(WorkflowsPage.addNodeLoop).click();
    const node = page.locator('[data-testid="loop-node"]');
    await expect(node).toBeVisible();
    const borderRadius = await node.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(borderRadius).toBe('999px');
    const handles = node.locator('.react-flow__handle');
    expect(await handles.count()).toBeGreaterThanOrEqual(3);
  });

  test('Issue 42: action nodes have visible connection handles', async ({ page, login }) => {
    await login();
    await page.goto('/workflows');
    await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/workflows') && resp.request().method() === 'POST' && resp.status() === 201,
    );
    await page.locator(WorkflowsPage.btnNewWorkflow).click();
    await expect(page.locator(WorkflowsPage.createModal)).toBeVisible();
    await page.locator(WorkflowsPage.createNameInput).fill('Test Issue 42');
    await page.locator(WorkflowsPage.createCreateBtn).click();
    const created = await (await createResponse).json() as { id: string };
    test.info().annotations.push({ type: 'workflowId', description: created.id });
    await page.locator(WorkflowsPage.addNodeAction).click();
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible();
    const handles = node.locator('.react-flow__handle');
    expect(await handles.count()).toBeGreaterThanOrEqual(2);
  });
});
