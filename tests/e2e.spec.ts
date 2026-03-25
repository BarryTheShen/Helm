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
    await page.evaluate(() => localStorage.clear());
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(2000);

    const hasWelcome = await page.getByText(/Welcome to Helm/i).count();
    expect(hasWelcome).toBeGreaterThan(0);

    const setupButton = page.getByText('Setup', { exact: true });
    await expect(setupButton).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to connect screen', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(2000);

    const serverInput = page.getByPlaceholder(/localhost/i).first();
    await expect(serverInput).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Integration Tests', () => {
  test('full auth flow: connect -> setup -> login', async ({ page }) => {
    // Clear stored auth to force connect screen
    await page.goto(FRONTEND_URL);
    await page.evaluate(() => localStorage.clear());
    await page.goto(FRONTEND_URL);
    await page.waitForTimeout(2000);

    // Step 1: Fill the setup form
    const serverInput = page.getByPlaceholder(/localhost/i).first();
    await serverInput.fill(BACKEND_URL);

    const usernameInput = page.getByPlaceholder(/username/i);
    await usernameInput.fill('testuser');

    const passwordInput = page.getByPlaceholder(/password/i);
    await passwordInput.fill('testpass123');

    const setupButton = page.getByText('Setup', { exact: true });
    await setupButton.click();

    // After setup (or 409 already-setup), router navigates to login
    await expect(page).toHaveURL(/login/, { timeout: 5000 });

    // Step 2: Login
    const loginUsernameInput = page.getByPlaceholder(/username/i);
    await expect(loginUsernameInput).toBeVisible({ timeout: 5000 });
    await loginUsernameInput.fill('testuser');

    const loginPasswordInput = page.getByPlaceholder(/password/i);
    await loginPasswordInput.fill('testpass123');

    const signInButton = page.getByText('Sign In', { exact: true }).last();
    await signInButton.click();

    // Step 3: Should land on main app
    await expect(page).toHaveURL(/chat/, { timeout: 8000 });
  });
});
