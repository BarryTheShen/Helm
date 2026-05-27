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
    const dropdown = page.locator('select').first();
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
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();
    await input.fill('hello world');
    const val = await input.inputValue();
    expect(val).toBe('hello world');
    expect(val.length).toBe(11);
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
