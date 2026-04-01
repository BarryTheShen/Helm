const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const appLogs = [];
  page.on('console', msg => { const t = msg.text(); if (t.includes('SDUI') || t.includes('Action') || t.includes('dispatch')) appLogs.push(t); });
  const login = await (await fetch('http://localhost:8000/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123', device_id: 'pw2', device_name: 'PW2' })
  })).json();
  console.log('Token:', login.session_token ? 'OK' : 'FAIL');
  await page.goto('http://localhost:19006', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((d) => {
    localStorage.setItem('auth_token', d.session_token);
    localStorage.setItem('server_url', 'http://localhost:8000');
    localStorage.setItem('username', 'testuser');
  }, login);
  await page.goto('http://localhost:19006/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('[role="button"]')).map(b => (b.textContent || '').trim().substring(0, 50)));
  console.log('Buttons:', btns);
  // Just test Add Stop (navigate action - proven to work)
  if (btns.some(b => b.includes('Add Stop'))) {
    appLogs.length = 0;
    const before = page.url();
    await page.evaluate(() => { for (const el of document.querySelectorAll('[role="button"]')) if ((el.textContent||'').includes('Add Stop')) { el.click(); return; } });
    await page.waitForTimeout(2000);
    console.log('Add Stop:', before, '->', page.url(), 'NAVIGATED:', before !== page.url());
  } else {
    console.log('Add Stop button NOT FOUND');
  }
  console.log('Logs:', appLogs.slice(0, 5));
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
