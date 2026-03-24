import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:8082';

test.describe('Backend API Tests', () => {
  test('health check endpoint responds', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
  });

  test('auth status endpoint responds', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/auth/status`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('setup_complete');
    expect(data).toHaveProperty('server_name');
    expect(data).toHaveProperty('version');
  });

  test('setup creates first user', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/auth/setup`, {
      data: {
        username: 'testuser',
        password: 'testpass123',
      },
    });

    // May fail if already setup (409), which is OK
    if (response.status() === 409) {
      console.log('Server already setup, skipping');
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('user_id');
    expect(data.message).toBe('Setup complete');
  });

  test('login with valid credentials', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      data: {
        username: 'testuser',
        password: 'testpass123',
        device_id: 'test-device-123',
        device_name: 'Test Device',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('session_token');
    expect(data).toHaveProperty('expires_at');
    expect(data).toHaveProperty('user_id');
  });
});

test.describe('Frontend Tests', () => {
  test('frontend loads and shows connect screen', async ({ page }) => {
    await page.goto(FRONTEND_URL);

    // Wait for React to render
    await page.waitForTimeout(2000);

    // Check if the page has content
    const content = await page.textContent('body');
    expect(content).toBeTruthy();

    // Look for "Helm" or "Welcome" text
    const hasWelcome = await page.getByText(/Welcome to Helm|Helm|Connect/i).count();
    expect(hasWelcome).toBeGreaterThan(0);
  });

  test('can navigate to connect screen', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(2000);

    // Should show server URL input
    const serverInput = page.getByPlaceholder(/server|localhost|http/i);
    await expect(serverInput).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Integration Tests', () => {
  test('full auth flow: connect -> setup -> login', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(2000);

    // Step 1: Connect to server
    const serverInput = page.getByPlaceholder(/server|localhost|http/i);
    await serverInput.fill(BACKEND_URL);

    const connectButton = page.getByRole('button', { name: /connect/i });
    await connectButton.click();

    await page.waitForTimeout(1000);

    // Step 2: Should redirect to login or show login form
    // (Setup may already be done, so we look for login elements)
    const usernameInput = page.getByPlaceholder(/username/i);
    await expect(usernameInput).toBeVisible({ timeout: 5000 });
  });
});
