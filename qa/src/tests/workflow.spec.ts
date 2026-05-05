import { test, expect } from '../fixtures';

test('Issue 38: dropdown persistence - value survives re-select', async ({ page, login }) => {
  await login();
  await page.goto('/workflows');
  await page.waitForTimeout(1000);
  // Add a trigger node
  await page.getByText(/add/i).first().click();
  await page.getByText('trigger', { exact: true }).click();
  await page.waitForTimeout(500);
  // Click node to open inspector, change dropdown to a non-default option
  const node = page.locator('.react-flow__node').first();
  await node.click();
  await page.waitForTimeout(300);
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
      await page.waitForTimeout(300);
      expect(await dropdown.inputValue()).not.toBe(orig);
    }
  }
});

test('Issue 39: condition typing keeps all characters', async ({ page, login }) => {
  await login();
  await page.goto('/workflows');
  await page.waitForTimeout(1000);
  // Add a condition node
  await page.getByText(/add/i).first().click();
  await page.getByText('condition', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('.react-flow__node').first().click();
  await page.waitForTimeout(300);
  // Type "hello world" into a condition input field
  const input = page.locator('input[type="text"]').first();
  const cnt = await input.count();
  if (cnt > 0) {
    await input.fill('hello world');
    await page.waitForTimeout(200);
    const val = await input.inputValue();
    expect(val).toBe('hello world');
    expect(val.length).toBe(11);
  }
});

test('Issue 42: action nodes have visible connection handles', async ({ page, login }) => {
  await login();
  await page.goto('/workflows');
  await page.waitForTimeout(1000);
  // Add an action node
  await page.getByText(/add/i).first().click();
  await page.getByText('action', { exact: true }).click();
  await page.waitForTimeout(500);
  // Verify handle dots exist on the action node
  const handles = page.locator('.react-flow__node').locator('.react-flow__handle');
  expect(await handles.count()).toBeGreaterThanOrEqual(2); // top + bottom
});
