import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
});

const context = await browser.newContext({ permissions: ['microphone'] });
const page = await context.newPage();

// Capture ALL console messages
page.on('console', msg => {
  console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
});

// Capture page errors
page.on('pageerror', error => {
  console.log(`[PAGE ERROR] ${error.message}\n${error.stack}`);
});

await page.goto('https://tuner.weiszfeld.com');
console.log('\n=== Clicking Start Tuner ===\n');
await page.click('button:has-text("Start Tuner")');
await page.waitForTimeout(6000);

await browser.close();
