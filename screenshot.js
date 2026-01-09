const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');

(async () => {
  console.log('Starting server...');
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4173']);
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  // Test both mobile and desktop viewports
  const viewports = [
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3 }, // iPhone 12 Pro
    { name: 'desktop', width: 1920, height: 1080, deviceScaleFactor: 1 } // Desktop 1080p
  ];

  for (const viewport of viewports) {
    console.log(`\nTesting ${viewport.name} viewport (${viewport.width}x${viewport.height})...`);

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
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

      await page.screenshot({ path: `screenshot-start-${viewport.name}.png` });

      console.log('Clicking Start...');
      await page.click('#start-btn');

      // Wait for canvas to appear
      await page.waitForSelector('canvas', { timeout: 5000 });
      // Wait a bit for initial render
      await page.waitForTimeout(1000);

      await page.screenshot({ path: `screenshot-ui-${viewport.name}.png` });
      console.log(`Captured ${viewport.name} UI.`);

    } catch (e) {
      console.error(`Error testing ${viewport.name}:`, e);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  server.kill();
  process.exit(0);
})();