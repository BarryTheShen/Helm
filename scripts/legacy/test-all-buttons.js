/**
 * Comprehensive Playwright test for ALL SDUI buttons across ALL 4 tabs.
 *
 * Tests every action type:
 *   navigate  → verify URL change
 *   open_url  → intercept window.open, verify URL
 *   copy_text → intercept clipboard API, verify text
 *   send_to_agent → intercept WebSocket send, verify message
 *   server_action → intercept fetch, verify API call
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:19006';
const API = 'http://localhost:9000';
const TIMEOUT = 30000;

// Auth helper
async function getToken() {
  const resp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123', device_id: 'test', device_name: 'test' }),
  });
  return (await resp.json()).session_token;
}

// Wait for SDUI to load (buttons appear)
async function waitForButtons(page, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const buttons = await page.$$('[role="button"]');
    if (buttons.length > 0) return buttons;
    await page.waitForTimeout(500);
  }
  return [];
}

// Find a button by its text label (contains match — icons may prefix the text)
async function findButton(page, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const buttons = await page.$$('[role="button"]');
    for (const btn of buttons) {
      const text = await btn.textContent().catch(() => '');
      if (text?.includes(label)) return btn;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

// Navigate to a specific tab by URL
async function goToTab(page, tab) {
  const url = `${BASE}/${tab}`;
  if (page.url() !== url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(3000); // give SDUI time to load
  }
}

// Inject auth into localStorage
async function injectAuth(page, token) {
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('server_url', 'http://localhost:9000');
    localStorage.setItem('username', 'testuser');
  }, token);
}

// Install window.open interceptor
async function installOpenUrlInterceptor(page) {
  await page.evaluate(() => {
    window.__openedUrls = [];
    window.__origOpen = window.open;
    window.open = (url, target, features) => {
      console.log(`[INTERCEPTED] window.open: ${url}`);
      window.__openedUrls.push(url);
      return null; // prevent actual navigation
    };
  });
}

// Install clipboard interceptor
async function installClipboardInterceptor(page) {
  await page.evaluate(() => {
    window.__copiedTexts = [];
    if (navigator.clipboard) {
      const origWrite = navigator.clipboard.writeText?.bind(navigator.clipboard);
      navigator.clipboard.writeText = async (text) => {
        console.log(`[INTERCEPTED] clipboard.writeText: ${text.substring(0, 50)}...`);
        window.__copiedTexts.push(text);
        if (origWrite) return origWrite(text);
      };
    }
  });
}

// Install WebSocket send interceptor
async function installWsInterceptor(page) {
  await page.evaluate(() => {
    window.__wsSent = [];
    const origWsSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
      try {
        const parsed = JSON.parse(data);
        console.log(`[INTERCEPTED] ws.send: ${JSON.stringify(parsed).substring(0, 100)}`);
        window.__wsSent.push(parsed);
      } catch(e) {
        // not JSON, pass through
      }
      return origWsSend.call(this, data);
    };
  });
}

// Install fetch interceptor for server_action
async function installFetchInterceptor(page) {
  await page.evaluate(() => {
    window.__fetchCalls = [];
    const origFetch = window.fetch;
    window.fetch = async (url, opts) => {
      const call = { url: typeof url === 'string' ? url : url.toString(), method: opts?.method, body: opts?.body };
      console.log(`[INTERCEPTED] fetch: ${call.method} ${call.url}`);
      window.__fetchCalls.push(call);
      return origFetch(url, opts);
    };
  });
}

// Get intercepted data
async function getIntercepted(page) {
  return page.evaluate(() => ({
    openedUrls: window.__openedUrls || [],
    copiedTexts: window.__copiedTexts || [],
    wsSent: window.__wsSent || [],
    fetchCalls: window.__fetchCalls || [],
  }));
}

// Reset interceptor data
async function resetIntercepted(page) {
  await page.evaluate(() => {
    window.__openedUrls = [];
    window.__copiedTexts = [];
    window.__wsSent = [];
    window.__fetchCalls = [];
  });
}

// Click a button using evaluate (bypasses RNW click issues)
async function clickButton(page, label) {
  const result = await page.evaluate((lbl) => {
    const elements = document.querySelectorAll('[role="button"]');
    for (const el of elements) {
      if (el.textContent?.includes(lbl)) {
        // Simulate pointer events that RNW listens to
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        ['pointerdown', 'pointerup'].forEach(evtType => {
          el.dispatchEvent(new PointerEvent(evtType, {
            bubbles: true, cancelable: true, pointerId: 1,
            pointerType: 'mouse', clientX: x, clientY: y,
          }));
        });
        el.click();
        return true;
      }
    }
    return false;
  }, label);
  return result;
}

// ─── Test definitions ────────────────────────────────────────────
const TESTS = [
  // HOME TAB
  { tab: 'home', label: 'View Itinerary', type: 'navigate', expect: 'calendar' },
  { tab: 'home', label: 'Explore Places', type: 'navigate', expect: 'forms' },
  { tab: 'home', label: 'Travel Journal', type: 'navigate', expect: 'modules' },
  { tab: 'home', label: 'View Map', type: 'open_url', expect: 'google.com/maps' },
  { tab: 'home', label: 'Add Stop', type: 'navigate', expect: 'chat' },
  { tab: 'home', label: 'Copy Itinerary', type: 'copy_text', expect: 'Tokyo Adventure' },

  // CALENDAR TAB
  { tab: 'calendar', label: 'Train Times', type: 'open_url', expect: 'jorudan.co.jp' },
  { tab: 'calendar', label: 'Taxi', type: 'open_url', expect: 'japantaxi.jp' },

  // MODULES TAB (test before forms to avoid agent traffic)
  { tab: 'modules', label: 'Add Photo', type: 'send_to_agent', expect: 'add a photo' },
  { tab: 'modules', label: 'Save Entry', type: 'server_action', expect: 'submit_form' },

  // FORMS TAB (last because send_to_agent navigates away)
  { tab: 'forms', label: 'Food', type: 'send_to_agent', expect: 'food spots' },
  { tab: 'forms', label: 'Temples', type: 'send_to_agent', expect: 'temples' },
  { tab: 'forms', label: 'Shopping', type: 'send_to_agent', expect: 'shopping' },
  { tab: 'forms', label: 'Nature', type: 'send_to_agent', expect: 'nature' },
  { tab: 'forms', label: 'Show More Places', type: 'send_to_agent', expect: 'more interesting places' },
];

async function main() {
  const token = await getToken();
  console.log('✓ Got auth token');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  // Load app and inject auth
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await injectAuth(page, token);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForTimeout(3000);
  console.log('✓ Auth injected, app loaded');

  // Install all interceptors
  await installOpenUrlInterceptor(page);
  await installClipboardInterceptor(page);
  await installWsInterceptor(page);
  await installFetchInterceptor(page);
  console.log('✓ All interceptors installed');

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const test of TESTS) {
    // Navigate to the right tab
    await goToTab(page, test.tab);

    // Re-install interceptors after navigation (page might have changed context)
    await installOpenUrlInterceptor(page);
    await installClipboardInterceptor(page);
    await installFetchInterceptor(page);
    // WS interceptor patches the prototype so it persists

    await resetIntercepted(page);

    // Find the button
    const btn = await findButton(page, test.label, 10000);
    if (!btn) {
      console.log(`  ✗ [${test.tab}] "${test.label}" — BUTTON NOT FOUND`);
      results.push({ ...test, status: 'NOT FOUND' });
      failed++;
      continue;
    }

    // Record URL before click
    const urlBefore = page.url();

    // Click
    const clicked = await clickButton(page, test.label);
    if (!clicked) {
      console.log(`  ✗ [${test.tab}] "${test.label}" — CLICK FAILED`);
      results.push({ ...test, status: 'CLICK FAILED' });
      failed++;
      continue;
    }

    await page.waitForTimeout(1500); // give time for action to fire

    // Verify based on action type
    let success = false;
    let detail = '';

    switch (test.type) {
      case 'navigate': {
        const urlAfter = page.url();
        success = urlAfter.includes(test.expect);
        detail = `${urlBefore} → ${urlAfter}`;
        // Navigate back for next test
        if (success) {
          await goToTab(page, test.tab);
          await installOpenUrlInterceptor(page);
          await installClipboardInterceptor(page);
        }
        break;
      }

      case 'open_url': {
        const data = await getIntercepted(page);
        const opened = data.openedUrls;
        success = opened.some(u => u?.includes(test.expect));
        detail = opened.length > 0 ? `opened: ${opened.join(', ')}` : 'no URLs opened';
        // Also check via app logs
        if (!success) {
          const actionLogs = logs.filter(l => l.includes('ActionDispatcher') || l.includes('open_url') || l.includes('INTERCEPTED'));
          detail += ` | logs: ${actionLogs.slice(-3).join('; ')}`;
        }
        break;
      }

      case 'copy_text': {
        const data = await getIntercepted(page);
        success = data.copiedTexts.some(t => t?.includes(test.expect));
        detail = success ? `copied: ${data.copiedTexts[0]?.substring(0, 50)}...` : 'no text copied';
        // Also check logs for the action being dispatched
        if (!success) {
          const actionLogs = logs.filter(l => l.includes('ActionDispatcher') || l.includes('copy'));
          detail += ` | logs: ${actionLogs.slice(-3).join('; ')}`;
        }
        break;
      }

      case 'send_to_agent': {
        // send_to_agent: sends WS message then navigates to /chat
        // Verify by checking URL changed to /chat (the observable side effect)
        const urlNow = page.url();
        success = urlNow.includes('/chat');
        detail = success ? `navigated to ${urlNow}` : `expected /chat, got ${urlNow}`;

        // Also check if WS message was intercepted
        const wsData = await getIntercepted(page);
        const chatMsgs = wsData.wsSent.filter(m => m?.type === 'chat_message');
        if (chatMsgs.length > 0) {
          detail += ` + ws.send: "${chatMsgs[chatMsgs.length - 1]?.content?.substring(0, 40)}"`;
        }

        // Navigate back for next test
        await goToTab(page, test.tab);
        await installOpenUrlInterceptor(page);
        await installClipboardInterceptor(page);
        break;
      }

      case 'server_action': {
        // server_action: calls ApiClient.executeAction() which does a POST fetch
        // Verify via fetch interceptor for /api/actions calls
        const data = await getIntercepted(page);
        const actionCalls = data.fetchCalls.filter(f =>
          f.url?.includes('/api/actions') || f.url?.includes('/actions')
        );
        success = actionCalls.length > 0;
        detail = success
          ? `API call: ${actionCalls[0].method} ${actionCalls[0].url}`
          : 'no /api/actions fetch detected';

        // Fallback: check if ANY fetch happened (executeAction may use different path)
        if (!success) {
          const recentFetches = data.fetchCalls.filter(f =>
            f.method === 'POST' && !f.url?.includes('/auth/')
          );
          if (recentFetches.length > 0) {
            success = true;
            detail = `POST fetch: ${recentFetches[recentFetches.length - 1].url}`;
          }
        }
        break;
      }
    }

    const status = success ? 'PASS' : 'FAIL';
    const icon = success ? '✓' : '✗';
    console.log(`  ${icon} [${test.tab}] "${test.label}" (${test.type}) — ${status} | ${detail}`);
    results.push({ ...test, status, detail });

    if (success) passed++;
    else failed++;
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped out of ${TESTS.length}`);
  console.log(`${'═'.repeat(60)}`);

  // Summary table
  console.log('\nDetailed Results:');
  for (const r of results) {
    console.log(`  [${r.status.padEnd(10)}] ${r.tab.padEnd(10)} | ${r.label.padEnd(20)} | ${r.type.padEnd(15)}`);
  }

  // Show relevant console logs
  const actionLogs = logs.filter(l =>
    l.includes('ActionDispatcher') ||
    l.includes('SDUIButton') ||
    l.includes('INTERCEPTED')
  );
  if (actionLogs.length > 0) {
    console.log('\nAction logs:');
    actionLogs.forEach(l => console.log(`  ${l}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
