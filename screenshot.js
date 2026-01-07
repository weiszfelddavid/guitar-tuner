const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');

(async () => {
  console.log('Starting server...');
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4173']);
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12 Pro
    deviceScaleFactor: 3,
    permissions: ['microphone']
  });
  const page = await context.newPage();

  try {
    console.log('Navigating...');
    await page.goto('http://localhost:4173');
    
    // Inject mock for getUserMedia just in case flags don't work in this specific env
    await page.addInitScript(() => {
        if (!navigator.mediaDevices) navigator.mediaDevices = {};
        navigator.mediaDevices.getUserMedia = async (constraints) => {
            console.log("Mock getUserMedia called");
            // Return a fake stream
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const dest = ctx.createMediaStreamDestination();
            osc.connect(dest);
            osc.start();
            return dest.stream;
        };
    });

    await page.screenshot({ path: 'screenshot-start.png' });

    console.log('Clicking Start...');
    await page.click('#start-btn');
    
    // Wait for canvas to appear
    await page.waitForSelector('canvas', { timeout: 5000 });
    // Wait a bit for initial render
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'screenshot-ui.png' });
    console.log('Captured UI.');

  } catch (e) {
    console.error("Error:", e);
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
})();