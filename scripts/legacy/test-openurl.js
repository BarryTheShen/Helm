const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('APP:', msg.text()));
  
  const login = await (await fetch('http://localhost:9000/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123', device_id: 'pw', device_name: 'PW' })
  })).json();
  
  await page.goto('http://localhost:19006', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((data) => {
    localStorage.setItem('auth_token', data.session_token);
    localStorage.setItem('server_url', 'http://localhost:9000');
    localStorage.setItem('username', 'testuser');
  }, login);
  
  await page.goto('http://localhost:19006/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Wait for View Map button to appear (SDUI data loading)
  console.log('Waiting for View Map button...');
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const found = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[role="button"]'))
        if ((el.textContent||'').includes('View Map')) return true;
      return false;
    });
    if (found) { console.log(`  Found after ${i+1}s`); break; }
    if (i === 14) console.log('  NOT FOUND after 15s');
  }
  
  // Dump page content
  const text = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '(empty)');
  console.log('Content:', text.substring(0, 150));
  
  // Mock window.open
  await page.evaluate(() => {
    window.__openUrls = [];
    window.open = function(url, target) {
      window.__openUrls.push({ url, target });
      console.log('INTERCEPTED window.open: ' + url);
      return { close: () => {} };
    };
  });
  
  // Click View Map
  console.log('Clicking View Map...');
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[role="button"]'))
      if ((el.textContent||'').includes('View Map')) { el.click(); return; }
  });
  await page.waitForTimeout(2000);
  
  const urls = await page.evaluate(() => window.__openUrls || []);
  console.log('Opened URLs:', JSON.stringify(urls));
  console.log('Current URL:', page.url());
  
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
