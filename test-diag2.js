/**
 * Diagnostic: dump what's actually rendered on each tab page.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:19006';
const API = 'http://localhost:8000';

async function getToken() {
  const resp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123', device_id: 'test', device_name: 'test' }),
  });
  return (await resp.json()).session_token;
}

async function main() {
  const token = await getToken();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('SDUI') || text.includes('Action') || text.includes('Button') || text.includes('screen') || text.includes('error')) {
      logs.push(text);
    }
  });

  // Load and auth
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('server_url', 'http://localhost:8000');
    localStorage.setItem('username', 'testuser');
  }, token);
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  for (const tab of ['home', 'calendar', 'forms', 'modules']) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`TAB: ${tab}`);
    console.log(`${'═'.repeat(50)}`);

    await page.goto(`${BASE}/${tab}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Dump all buttons
    const buttons = await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="button"]');
      return Array.from(btns).map(b => ({
        text: b.textContent?.trim().substring(0, 50),
        tag: b.tagName,
        classes: b.className?.substring(0, 50),
        visible: b.offsetWidth > 0 && b.offsetHeight > 0,
        rect: b.getBoundingClientRect(),
      }));
    });

    console.log(`  Buttons found: ${buttons.length}`);
    for (const b of buttons) {
      console.log(`    "${b.text}" (${b.tag}) visible=${b.visible} ${Math.round(b.rect.width)}x${Math.round(b.rect.height)}`);
    }

    // Dump page text (first 500 chars)
    const text = await page.evaluate(() => {
      return document.body?.innerText?.substring(0, 500);
    });
    console.log(`  Page text (first 500): ${text?.replace(/\n/g, ' | ').substring(0, 300)}`);

    // Check for any loading indicators or error messages
    const status = await page.evaluate(() => {
      const body = document.body?.innerText || '';
      return {
        hasLoading: body.includes('Loading') || body.includes('loading'),
        hasError: body.includes('Error') || body.includes('error') || body.includes('failed'),
        hasNoContent: body.length < 50,
      };
    });
    console.log(`  Status: loading=${status.hasLoading} error=${status.hasError} empty=${status.hasNoContent}`);
  }

  // Show relevant logs
  if (logs.length > 0) {
    console.log('\n\nRelevant console logs:');
    logs.slice(-30).forEach(l => console.log(`  ${l.substring(0, 120)}`));
  }

  await browser.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
