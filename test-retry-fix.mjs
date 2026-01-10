import { chromium } from '@playwright/test';

console.log('\n🧪 Testing AudioWorklet Retry Fix...\n');

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream'
  ]
});

const context = await browser.newContext({ permissions: ['microphone'] });
const page = await context.newPage();

// Collect all console messages
const consoleMessages = [];
page.on('console', msg => {
  const text = msg.text();
  consoleMessages.push(`[${msg.type()}] ${text}`);
  console.log(`[${msg.type()}] ${text}`);
});

// Capture page errors
page.on('pageerror', error => {
  console.log(`❌ [PAGE ERROR] ${error.message}`);
});

try {
  console.log('📡 Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

  console.log('\n🎯 Clicking "Start Tuner" button...');
  await page.click('button:has-text("Start Tuner")');

  console.log('⏳ Waiting 10 seconds for initialization...\n');
  await page.waitForTimeout(10000);

  // Check if we see retry attempts in console
  const retryMessages = consoleMessages.filter(msg =>
    msg.includes('Retry attempt') ||
    msg.includes('AudioWorkletNode created successfully') ||
    msg.includes('Worklet fully initialized')
  );

  // Check for errors
  const errorMessages = consoleMessages.filter(msg =>
    msg.includes('not defined') ||
    msg.includes('failed') ||
    msg.includes('error')
  );

  console.log('\n📊 Results:');
  console.log('─────────────────────────────────');

  if (retryMessages.length > 0) {
    console.log('✅ Retry logic executed:');
    retryMessages.forEach(msg => console.log('   ' + msg));
  }

  if (errorMessages.length > 0) {
    console.log('\n⚠️  Errors detected:');
    errorMessages.forEach(msg => console.log('   ' + msg));
  }

  // Check if canvas exists (tuner started successfully)
  const canvasExists = await page.$('canvas#tuner-canvas');

  console.log('\n🎯 Final Status:');
  if (canvasExists) {
    console.log('✅ SUCCESS: Tuner canvas rendered - AudioWorklet initialized!');
  } else {
    console.log('❌ FAILED: Canvas not found - initialization failed');
  }

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
}

await browser.close();
console.log('\n✨ Test complete.\n');
