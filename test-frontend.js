const fs = require('fs');
const puppeteer = require('puppeteer-core');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console logs and errors
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  page.on('pageerror', error => {
    const text = `[PAGE ERROR] ${error.message}`;
    errors.push(text);
    console.error(text);
  });

  page.on('requestfailed', request => {
    const text = `[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`;
    errors.push(text);
    console.error(text);
  });

  console.log('\nNavigating to http://localhost:8082...');
  await page.goto('http://localhost:8082', { waitUntil: 'networkidle0', timeout: 10000 });

  console.log('\nWaiting for page to render...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Take a screenshot
  const screenshotPath = 'test-results/frontend-screenshot.png';
  fs.mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Get page content
  const bodyText = await page.evaluate(() => document.body.innerText);
  const html = await page.content();

  console.log('\n=== Page Text Content ===');
  console.log(bodyText || '(empty)');

  console.log('\n=== Console Logs ===');
  if (logs.length === 0) {
    console.log('(no console logs)');
  }

  console.log('\n=== Errors ===');
  if (errors.length === 0) {
    console.log('(no errors)');
  }

  console.log('\n=== Root Element ===');
  const rootHTML = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : '(root element not found)';
  });
  console.log(rootHTML.substring(0, 200) || '(empty)');

  await browser.close();

  if (bodyText.trim().length === 0) {
    console.log('\n❌ FRONTEND IS BLANK - No content rendered');
    console.log('Check the errors above for the root cause.');
    process.exit(1);
  } else {
    console.log('\n✅ FRONTEND IS WORKING');
    process.exit(0);
  }
})();
