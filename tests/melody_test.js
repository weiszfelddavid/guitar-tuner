const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  console.log('Starting server...');
  // Run preview from project root
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4174'], { cwd: path.resolve(__dirname, '..') });
  
  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream']
  });

  // Test both mobile and desktop viewports
  const viewports = [
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3 }, // iPhone 12 Pro
    { name: 'desktop', width: 1920, height: 1080, deviceScaleFactor: 1 } // Desktop 1080p
  ];

  for (const viewport of viewports) {
    console.log(`\n=== Testing ${viewport.name} viewport (${viewport.width}x${viewport.height}) ===`);

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      permissions: ['microphone']
    });
    const page = await context.newPage();

    // Capture logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    try {
      console.log('Navigating...');

      // Inject mock
      await page.addInitScript(() => {
          console.log("INIT SCRIPT RUNNING");
          if (!navigator.mediaDevices) {
              // @ts-ignore
              navigator.mediaDevices = {};
          }

          let osc;
          let ctx;

          // @ts-ignore
          window.setMockFreq = (freq) => {
              if (osc && ctx) {
                  console.log(`Setting mock freq to ${freq}`);
                  osc.frequency.setValueAtTime(freq, ctx.currentTime);
              } else {
                  console.log("Oscillator not ready yet");
              }
          };

          // Use defineProperty to ensure we can overwrite it
          Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
              value: async (constraints) => {
                  console.log("Mock getUserMedia called with constraints:", JSON.stringify(constraints));
                  ctx = new AudioContext();
                  osc = ctx.createOscillator();
                  osc.frequency.value = 82.41; // Start with E2
                  const dest = ctx.createMediaStreamDestination();
                  osc.connect(dest);
                  osc.start();
                  return dest.stream;
              },
              writable: true
          });
      });

      await page.goto('http://localhost:4174');

      console.log('Clicking Start...');
      await page.click('#start-btn');

      await page.waitForSelector('canvas', { timeout: 10000 });

      // Melody: E2, A2, D3, G3, B3, E4
      const melody = [
          { note: 'E2', freq: 82.41 },
          { note: 'A2', freq: 110.00 },
          { note: 'D3', freq: 146.83 },
          { note: 'G3', freq: 196.00 },
          { note: 'B3', freq: 246.94 },
          { note: 'E4', freq: 329.63 }
      ];

      for (const item of melody) {
          console.log(`Testing note: ${item.note} (${item.freq} Hz)`);

          // Set frequency
          await page.evaluate((f) => window.setMockFreq(f), item.freq);

          // Wait for stabilization (simulating singing/playing)
          await page.waitForTimeout(2000);

          // Check state
          const state = await page.evaluate(() => window.getTunerState());
          console.log(`Detected: ${state.noteName}, Clarity: ${state.clarity}, Volume: ${state.volume}, Locked: ${state.isLocked}`);

          if (state.noteName !== item.note) {
              console.error(`FAILED: Expected ${item.note}, got ${state.noteName}`);
          } else {
              console.log(`PASSED: Detected ${item.note}`);
          }

          await page.screenshot({ path: `tests/screenshot-${item.note}-${viewport.name}.png` });
      }

      console.log(`Melody test complete for ${viewport.name}.`);

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
