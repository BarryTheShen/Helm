const { chromium } = require('playwright');
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZGRkNDFhNS01MWNkLTQ5OTItODViMC00YzA5N2ZmMGI1OTYiLCJleHAiOjE3NzcyMTYyMzksInR5cGUiOiJhY2Nlc3MiLCJqdGkiOiJkOTU5OWU5Ni01ZGM2LTQwZmYtOGIzZC02OGQxNjk1ZWRiZWUiLCJkZXZpY2VfaWQiOiJhN2IwZDVhOC1kZDVkLTRkOGQtYmI0NS04ZjVlMDg2MGEwY2QifQ.c6CSayAkX7CMOAIvOvFQwDWjdd-4dzZNzkvkMhvrFKs';
async function api(method, path, body) {
  const opts = { method, headers: { 'Authorization': 'Bearer '+TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('http://localhost:9000'+path, opts);
  return { status: r.status, body: await r.text() };
}
async function visit(page, path, label, wait) {
  await page.goto('http://localhost:8082/'+path, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(wait || 1500);
  await page.screenshot({ path: '/tmp/helm-'+label+'.png' });
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\n/g,' ').substring(0,150);
  console.log(label+': '+text.substring(0,120));
  return text;
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto('http://localhost:8082', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function(t) {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('server_url', 'http://localhost:9000');
    localStorage.setItem('username', 'testuser');
  }, TOKEN);

  // ===== TEST 1: Set home screen with CORRECT schema =====
  console.log('=== TEST 1: Correct SDUI schema (sections with nested component) ===');
  var r = await api('POST', '/api/sdui/home', {
    screen: {
      schema_version: 1,
      module_id: 'home',
      title: 'AI Home',
      sections: [
        { id: 's1', component: { type: 'heading', id: 'c1', props: { content: 'AI-Controlled Home', level: 1 } } },
        { id: 's2', component: { type: 'text', id: 'c2', props: { content: 'This screen was set via SDUI by the AI agent' } } },
        { id: 's3', component: { type: 'stats_row', id: 'c3', props: { stats: [
          { label: 'Tasks', value: '12' },
          { label: 'Events', value: '3' },
          { label: 'Alerts', value: '1' }
        ]}}}
      ]
    }
  });
  console.log('POST home: ' + r.status + ' ' + r.body.substring(0, 80));

  // Navigate to home and check
  var content = await visit(page, 'home', 'home-sdui-correct', 2000);
  var homeOk = content.includes('AI-Controlled') || content.includes('SDUI');
  console.log('Home SDUI renders correctly:', homeOk ? 'YES ✓' : 'NO ✗ (check screenshot)');

  // ===== TEST 2: Reload — verify persistence =====
  console.log('\n=== TEST 2: Persistence after reload ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/helm-home-persist.png' });
  var reloaded = (await page.evaluate(() => document.body.innerText)).replace(/\n/g,' ').substring(0,120);
  console.log('After reload: '+reloaded.substring(0,100));
  console.log('Persists:', (reloaded.includes('AI-Controlled') || reloaded.includes('SDUI')) ? 'YES ✓' : 'NO ✗');

  // ===== TEST 3: VIA WS PUSH — delete home while on page =====
  console.log('\n=== TEST 3: Live WS delete =====');
  r = await api('DELETE', '/api/sdui/home');
  console.log('DELETE home:', r.status, r.body);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/helm-home-ws-emptied.png' });
  var afterDelete = (await page.evaluate(() => document.body.innerText)).replace(/\n/g,' ').substring(0,120);
  console.log('After WS delete: '+afterDelete.substring(0,100));
  var emptyStateShown = afterDelete.includes('Ask the AI') || afterDelete.includes('empty');
  console.log('Empty state shown:', emptyStateShown ? 'YES ✓' : 'NO ✗');
  
  // ===== TEST 4: Forms with button and heading =====
  console.log('\n=== TEST 4: Forms tab SDUI ===');
  r = await api('POST', '/api/sdui/forms', { screen: {
    schema_version: 1, module_id: 'forms', title: 'Feedback Form',
    sections: [
      { id: 's1', component: { type: 'heading', id: 'c1', props: { content: 'Send Feedback', level: 2 } } },
      { id: 's2', component: { type: 'text', id: 'c2', props: { content: 'Use the form below to submit your feedback.' } } },
      { id: 's3', component: { type: 'button', id: 'c3', props: { label: 'Submit Feedback', variant: 'primary', action: { type: 'dismiss' } } } }
    ]
  }});
  console.log('POST forms: ' + r.status);
  content = await visit(page, 'forms', 'forms-sdui', 2000);
  var formsOk = content.includes('Send Feedback') || content.includes('Submit');
  console.log('Forms SDUI renders correctly:', formsOk ? 'YES ✓' : 'NO ✗ (check screenshot)');

  // ===== TEST 5: Settings with alert =====
  console.log('\n=== TEST 5: Settings tab with SDUI alert =====');
  r = await api('POST', '/api/sdui/settings', { screen: {
    schema_version: 1, module_id: 'settings', title: 'AI Settings',
    sections: [
      { id: 's1', component: { type: 'heading', id: 'c1', props: { content: 'App Settings', level: 2 } } },
      { id: 's2', component: { type: 'alert', id: 'c2', props: { severity: 'info', title: 'AI-Managed', message: 'This settings screen is controlled by the AI agent.' } } }
    ]
  }});
  console.log('POST settings: ' + r.status);
  content = await visit(page, 'settings', 'settings-sdui', 2000);
  var settingsOk = content.includes('App Settings') || content.includes('AI-Managed') || content.includes('AI agent');
  console.log('Settings SDUI renders correctly:', settingsOk ? 'YES ✓' : 'NO ✗ (check screenshot)');

  // ===== TEST 6: In-app chat agent tool definitions (verify set_screen is known) =====
  console.log('\n=== TEST 6: Verify chat agent knows set_screen tool ===');
  r = await api('POST', '/api/chat', { message: 'What SDUI tools do you have? List them with one word each.' });
  var chatResp = JSON.parse(r.body);
  console.log('Chat agent response:', JSON.stringify(chatResp).substring(0,200));
  
  // List all screens 
  r = await api('GET', '/api/sdui');
  console.log('\nAll screens in DB:', r.body);
  
  // Cleanup
  await api('DELETE', '/api/sdui/forms');
  await api('DELETE', '/api/sdui/settings');
  
  await browser.close();
  console.log('\n=== Tests complete ===');
})().catch(function(e) { console.error('ERROR: '+e.message+'\n'+e.stack); process.exit(1); });
