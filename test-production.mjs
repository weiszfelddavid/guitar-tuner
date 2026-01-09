import { chromium } from '@playwright/test';

const url = 'https://tuner.weiszfeld.com';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
});

const context = await browser.newContext({ permissions: ['microphone'] });
const page = await context.newPage();

// Track ALL network requests
const requests = [];
page.on('request', req => {
  if (req.url().includes('tuner-processor') || req.url().includes('.wasm')) {
    requests.push({ url: req.url(), method: req.method() });
  }
});

page.on('response', async res => {
  if (res.url().includes('tuner-processor')) {
    console.log(`\n=== Worklet Response ===`);
    console.log('URL:', res.url());
    console.log('Status:', res.status());
    console.log('Headers:', JSON.stringify(res.headers(), null, 2));

    // Check if content is valid
    const text = await res.text();
    console.log('Content length:', text.length);
    console.log('Has registerProcessor:', text.includes('registerProcessor'));
    console.log('First 200 chars:', text.substring(0, 200));
  }
});

// Capture ALL console logs
page.on('console', msg => {
  const text = msg.text();
  console.log(`[${msg.type()}] ${text}`);
});

try {
  await page.goto(url, { waitUntil: 'networkidle' });

  console.log('=== Clicking Start Tuner ===\n');
  await page.click('button:has-text("Start Tuner")');
  await page.waitForTimeout(5000);

  console.log('\n=== Network Requests ===');
  requests.forEach(r => console.log(`${r.method} ${r.url}`));

} catch (error) {
  console.error('Error:', error.message);
}

await browser.close();
