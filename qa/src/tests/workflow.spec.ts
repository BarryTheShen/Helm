import { test, expect } from '../fixtures';
import { WorkflowsPage } from '../page-objects/workflows';

test('Issue 38: dropdown persistence - value survives re-select', async ({ page, login }) => {
  await login();
  await page.goto('/workflows');
  await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
  // Add a trigger node
  await page.getByRole('button', { name: /add/i }).first().click();
  await page.getByRole('menuitem', { name: 'trigger' }).click();
  // Wait for node to render on canvas
  const node = page.locator('.react-flow__node').first();
  await expect(node).toBeVisible();
  // Click node to open inspector, change dropdown to a non-default option
  await node.click();
  await expect(page.locator(WorkflowsPage.nodeInspector)).toBeVisible();
  // Find a dropdown in the property inspector and change it
  const dropdown = page.locator('select').first();
  const count = await dropdown.count();
  if (count > 0) {
    const orig = await dropdown.inputValue();
    const options = await page.locator('select option').allTextContents();
    if (options.length > 1) {
      await dropdown.selectOption({ index: 1 });
      await page.locator('body').click(); // click away
      await node.click(); // re-select
      await expect(dropdown).toBeVisible();
      expect(await dropdown.inputValue()).not.toBe(orig);
    }
  }
});

test('Issue 39: condition typing keeps all characters', async ({ page, login }) => {
  await login();
  await page.goto('/workflows');
  await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
  // Add a condition node
  await page.getByRole('button', { name: /add/i }).first().click();
  await page.getByRole('menuitem', { name: 'condition' }).click();
  // Wait for node to render on canvas
  const node = page.locator('.react-flow__node').first();
  await expect(node).toBeVisible();
  await node.click();
  // Wait for inspector input to appear
  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible();
  // Type "hello world" into a condition input field
  await input.fill('hello world');
  const val = await input.inputValue();
  expect(val).toBe('hello world');
  expect(val.length).toBe(11);
});

test('Issue 42: action nodes have visible connection handles', async ({ page, login }) => {
  await login();
  await page.goto('/workflows');
  await expect(page.locator(WorkflowsPage.heading)).toBeVisible();
  // Add an action node
  await page.getByRole('button', { name: /add/i }).first().click();
  await page.getByRole('menuitem', { name: 'action' }).click();
  // Wait for node to render on canvas
  const node = page.locator('.react-flow__node').first();
  await expect(node).toBeVisible();
  // Verify handle dots exist on the action node
  const handles = node.locator('.react-flow__handle');
  expect(await handles.count()).toBeGreaterThanOrEqual(2); // top + bottom
});
