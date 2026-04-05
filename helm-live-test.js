#!/usr/bin/env node
/**
 * helm-live-test.js — Live browser test of the Helm app.
 * Tests: login, modules tab, chat SDUI commands, delete/edit functionality.
 */

const { chromium } = require('playwright');
const http = require('http');

const BASE_URL = 'http://localhost:8082';
const API_URL = 'http://localhost:8000';

async function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = {
      hostname: 'localhost',
      port: 8000,
      path,
      method,
      headers: { ...headers, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) },
    };
    const req = http.request(options, (res) => {
      let response = '';
      res.on('data', (chunk) => (response += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(response)); } catch { resolve(response); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Helm Live Browser Test ===\n');

  // Step 1: Get auth token via API
  console.log('1. Logging in via API...');
  const loginResp = await apiRequest('POST', '/auth/login', {
    username: 'testuser',
    password: 'testpass123',
    device_id: 'playwright-test',
    device_name: 'Playwright',
  });
  const token = loginResp.session_token;
  if (!token) {
    console.error('Login failed:', loginResp);
    process.exit(1);
  }
  console.log('   Token obtained ✅');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Step 2: Set localStorage with auth then navigate to app
  console.log('\n2. Opening app with auth...');
  await page.goto(BASE_URL);
  await page.evaluate(({ token }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('server_url', 'http://localhost:8000');
    localStorage.setItem('username', 'testuser');
  }, { token });
  await page.goto(`${BASE_URL}/home`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/helm-live-home.png', fullPage: true });
  console.log('   Screenshot: /tmp/helm-live-home.png');
  console.log('   URL:', page.url());

  // Step 3: Navigate to Modules tab
  console.log('\n3. Navigating to Modules tab...');
  await page.goto(`${BASE_URL}/modules`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/helm-live-modules.png', fullPage: true });
  console.log('   Screenshot: /tmp/helm-live-modules.png');

  // Check if there are edit/delete buttons
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('   Page content preview:', pageText.substring(0, 300));
  const hasDeleteButton = pageText.toLowerCase().includes('delete');
  const hasEditButton = pageText.toLowerCase().includes('edit');
  console.log('   Has Delete button?', hasDeleteButton);
  console.log('   Has Edit button?', hasEditButton);

  // Step 4: Check current SDUI screens in DB
  console.log('\n4. Checking current SDUI screens via API...');
  const screensResp = await apiRequest('GET', '/api/sdui', null, token);
  console.log('   Current SDUI screens:', JSON.stringify(screensResp, null, 2));

  // Step 5: Navigate to Chat tab and send a test message
  console.log('\n5. Navigating to Chat tab...');
  await page.goto(`${BASE_URL}/chat`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/helm-live-chat.png', fullPage: true });
  console.log('   Screenshot: /tmp/helm-live-chat.png');

  // Look for chat input
  const chatInput = await page.$('input[placeholder*="message" i], textarea[placeholder*="message" i], input[placeholder*="type" i], textarea[placeholder*="type" i]');
  if (chatInput) {
    console.log('   Chat input found ✅');
    // Type a test message
    await chatInput.fill('List all SDUI screens');
    await chatInput.press('Enter');
    console.log('   Sent: "List all SDUI screens"');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/helm-live-chat-response.png', fullPage: true });
    console.log('   Screenshot: /tmp/helm-live-chat-response.png');
    const chatContent = await page.evaluate(() => document.body.innerText);
    console.log('   Chat response preview:', chatContent.substring(0, 500));
  } else {
    console.log('   WARNING: Chat input not found ❌');
    // Try to find any input by looking at all inputs
    const inputs = await page.$$('input, textarea');
    console.log('   Found', inputs.length, 'input(s) on chat page');
    for (let i = 0; i < inputs.length; i++) {
      const placeholder = await inputs[i].getAttribute('placeholder');
      console.log('   Input', i, 'placeholder:', placeholder);
    }
  }

  // Step 6: Try setting a home screen via API and check if app updates
  console.log('\n6. Testing SDUI set_screen via REST API...');
  const setResp = await apiRequest('POST', '/api/sdui/home', {
    screen: {
      schema_version: 1,
      module_id: 'home',
      title: 'Live Test Home',
      sections: [{
        id: 's1',
        component: {
          type: 'heading',
          id: 'c1',
          props: { content: '🧪 Live Test: SDUI Works!', level: 1 }
        }
      }]
    }
  }, token);
  console.log('   set_screen response:', JSON.stringify(setResp));

  // Navigate to home and check if it shows the SDUI
  await page.goto(`${BASE_URL}/home`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/helm-live-home-sdui.png', fullPage: true });
  console.log('   Screenshot after set_screen: /tmp/helm-live-home-sdui.png');
  const homeContent = await page.evaluate(() => document.body.innerText);
  const hasSduiContent = homeContent.includes('Live Test: SDUI Works');
  console.log('   SDUI content visible?', hasSduiContent ? '✅ YES' : '❌ NO');
  console.log('   Home content:', homeContent.substring(0, 300));

  // Step 7: Test delete_screen via REST API
  console.log('\n7. Testing delete_screen via REST API...');
  const delResp = await apiRequest('DELETE', '/api/sdui/home', null, token);
  console.log('   delete_screen response:', JSON.stringify(delResp));
  await page.goto(`${BASE_URL}/home`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/helm-live-home-deleted.png', fullPage: true });
  console.log('   Screenshot after delete_screen: /tmp/helm-live-home-deleted.png');
  const homeAfterDelete = await page.evaluate(() => document.body.innerText);
  const sduiGone = !homeAfterDelete.includes('Live Test: SDUI Works');
  console.log('   SDUI content removed?', sduiGone ? '✅ YES' : '❌ NO');

  await browser.close();
  console.log('\n=== Test Complete ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
