const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const allLogs = [];
  page.on('console', msg => allLogs.push(msg.text()));
  
  const login = await (await fetch('http://localhost:8000/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123', device_id: 'diag', device_name: 'Diag' })
  })).json();
  console.log('Login:', login.session_token ? 'OK' : JSON.stringify(login));
  
  await page.goto('http://localhost:19006', { waitUntil: 'domcontentloaded' });
  await page.evaluate((d) => {
    localStorage.setItem('auth_token', d.session_token);
    localStorage.setItem('server_url', 'http://localhost:8000');
    localStorage.setItem('username', 'testuser');
  }, login);
  
  await page.goto('http://localhost:19006/home', { waitUntil: 'domcontentloaded' });
  
  // Poll every second and dump state
  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      url: window.location.href,
      text: (document.body?.innerText || '').substring(0, 300),
      btns: Array.from(document.querySelectorAll('[role="button"]')).map(b => (b.textContent||'').trim().substring(0, 30)),
      inputCount: document.querySelectorAll('input').length,
    }));
    console.log(`[${i}s] URL: ${state.url}`);
    console.log(`     Text: ${state.text.substring(0, 100).replace(/\n/g, ' | ')}`);
    console.log(`     Buttons: ${JSON.stringify(state.btns)}`);
    if (state.btns.length > 0 && state.btns.some(b => b.includes('View Map'))) {
      console.log('     SDUI LOADED!');
      break;
    }
  }
  
  // Print relevant logs
  const errLogs = allLogs.filter(l => l.toLowerCase().includes('error') || l.includes('failed') || l.includes('warn'));
  if (errLogs.length) console.log('\nError logs:', errLogs.slice(0, 5));
  
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
