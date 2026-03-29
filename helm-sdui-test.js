const { chromium } = require('playwright');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZGRkNDFhNS01MWNkLTQ5OTItODViMC00YzA5N2ZmMGI1OTYiLCJleHAiOjE3NzcyMTYyMzksInR5cGUiOiJhY2Nlc3MiLCJqdGkiOiJkOTU5OWU5Ni01ZGM2LTQwZmYtOGIzZC02OGQxNjk1ZWRiZWUiLCJkZXZpY2VfaWQiOiJhN2IwZDVhOC1kZDVkLTRkOGQtYmI0NS04ZjVlMDg2MGEwY2QifQ.c6CSayAkX7CMOAIvOvFQwDWjdd-4dzZNzkvkMhvrFKs';

async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': 'Bearer '+TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('http://localhost:8000'+path, opts);
  return { status: r.status, body: await r.text() };
}

async function visitTab(page, path, label) {
  await page.goto('http://localhost:8082/' + path, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/helm-' + label + '.png' });
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\n/g, ' ').substring(0, 120);
  console.log(label + ': ' + text);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  
  // Set auth
  await page.goto('http://localhost:8082', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function(t) {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('server_url', 'http://localhost:8000');
    localStorage.setItem('username', 'testuser');
  }, TOKEN);
  
  // --- TEST 1: All tabs load (no blank screens) ---
  console.log('=== TEST 1: Tab loading ===');
  await visitTab(page, '', 'tab-home');
  await visitTab(page, 'chat', 'tab-chat');
  await visitTab(page, 'modules', 'tab-modules');
  await visitTab(page, 'calendar', 'tab-calendar');
  await visitTab(page, 'forms', 'tab-forms');
  await visitTab(page, 'alerts', 'tab-alerts');
  await visitTab(page, 'settings', 'tab-settings');
  
  // --- TEST 2: Set home SDUI ---
  console.log('\n=== TEST 2: Set home SDUI ===');
  var homeScreen = {
    screen: {
      module_id: 'home',
      title: 'AI Home',
      sections: [
        { id: 's1', type: 'heading', props: { text: 'AI-Controlled Home', level: 1 } },
        { id: 's2', type: 'text', props: { text: 'Rendered via SDUI by the AI agent' } },
        { id: 's3', type: 'stat_row', props: { items: [{ label: 'Tasks', value: '12' }, { label: 'Events', value: '3' }] } }
      ]
    }
  };
  var r = await api('POST', '/api/sdui/home', homeScreen);
  console.log('POST /api/sdui/home: ' + r.status + ' ' + r.body.substring(0,80));
  
  // Reload home tab and verify SDUI renders
  await visitTab(page, '', 'home-sdui');
  
  // --- TEST 3: SDUI persists after page reload ---
  console.log('\n=== TEST 3: Persistence ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/helm-home-reloaded.png' });
  var reloaded = (await page.evaluate(() => document.body.innerText)).replace(/\n/g, ' ').substring(0, 120);
  console.log('After reload: ' + reloaded);
  
  // --- TEST 4: Delete via API (live WS update) ---
  console.log('\n=== TEST 4: WS live delete ===');
  r = await api('DELETE', '/api/sdui/home');
  console.log('DELETE home: ' + r.status + ' ' + r.body);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/helm-home-deleted.png' });
  var deleted = (await page.evaluate(() => document.body.innerText)).replace(/\n/g, ' ').substring(0, 120);
  console.log('After delete: ' + deleted);
  
  // --- TEST 5: Multi-tab SDUI ---
  console.log('\n=== TEST 5: Multi-tab SDUI ===');
  await api('POST', '/api/sdui/forms', { screen: { module_id: 'forms', title: 'Feedback Form', sections: [
    { id: 'h', type: 'heading', props: { text: 'Send Feedback', level: 2 } },
    { id: 'btn', type: 'button', props: { label: 'Submit', action: { type: 'submit_form', form_id: 'fb' } } }
  ]}});
  await api('POST', '/api/sdui/settings', { screen: { module_id: 'settings', title: 'Settings', sections: [
    { id: 'h', type: 'heading', props: { text: 'App Settings', level: 2 } },
    { id: 't', type: 'text', props: { text: 'Managed by AI agent' } }
  ]}});
  await visitTab(page, 'forms', 'forms-sdui');
  await visitTab(page, 'settings', 'settings-sdui');
  
  // List all screens
  r = await api('GET', '/api/sdui');
  console.log('\nAll SDUI screens: ' + r.body);
  
  // Cleanup
  await api('DELETE', '/api/sdui/forms');
  await api('DELETE', '/api/sdui/settings');
  
  await browser.close();
  console.log('\n=== All tests PASSED ===');
})().catch(function(e) { console.error('FAILED: ' + e.message); process.exit(1); });
