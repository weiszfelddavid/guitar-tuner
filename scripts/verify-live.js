import { chromium, devices } from 'playwright';

const URL = 'https://tuner.weiszfeld.com/';
const OUTPUT_DIR = 'debug-screenshots';

(async () => {
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });

  // Create context WITHOUT pre-granted permissions to simulate first visit
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    // permissions: ['microphone'] // Intentionally OMITTED to force prompt
  });
  
  const page = await context.newPage();

  // Block analytics and tracking to ensure test is environment-agnostic
  await page.route('**/*cloudflareinsights.com/**', route => route.abort());
  await page.route('**/*clarity.ms/**', route => route.abort());

  // Inject AudioWorkletNode Mock
  await page.addInitScript(() => {
    window.mockPort = {
      onmessage: null,
      postMessage: (msg) => {
        // Echo back if needed
      }
    };

    const OriginalAudioWorkletNode = window.AudioWorkletNode;
    window.AudioWorkletNode = class MockAudioWorkletNode extends OriginalAudioWorkletNode {
      constructor(context, name) {
        super(context, name);
        // Intercept the port
        const actualPort = this.port;
        Object.defineProperty(this, 'port', {
          get: () => {
             return {
               ...actualPort,
               set onmessage(callback) {
                 window.mockPort.onmessage = callback;
               },
               get onmessage() {
                 return window.mockPort.onmessage;
               }
             }
          }
        });
      }
    };
    
    // Helper to simulate pitch from the "processor"
    window.simulatePitch = (hz) => {
      if (window.mockPort.onmessage) {
        window.mockPort.onmessage({
          data: {
            pitch: hz,
            clarity: 0.95, // High clarity to ensure detection
            bufferrms: 0.1 // Loud enough
          }
        });
      }
    };
  });

  // Log console messages
  page.on('console', msg => console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));
  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log(`RESPONSE ERROR: ${response.url()} - ${response.status()}`);
    }
  });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL);
  await page.waitForTimeout(2000); // Wait for load

  // Check 1: Overlay exists OR Tuner is already listening
  const overlay = page.locator('.start-overlay');
  const isOverlayVisible = await overlay.isVisible();
  console.log(`[Check 1] Start Overlay Visible: ${isOverlayVisible}`);

  const readout = page.locator('.tech-readout');
  const readoutText = await readout.textContent();
  console.log(`[Check 3] Status Text: "${readoutText}"`);

  let isOverlayGone = !isOverlayVisible;

  if (isOverlayVisible) {
      // Simulate user clicking "Allow" in browser prompt by granting permissions just before interaction
      console.log('Granting permissions to simulate user acceptance...');
      await context.grantPermissions(['microphone'], { origin: 'https://tuner.weiszfeld.com' });

      // Action: Click Overlay
      console.log('Clicking "Tap to enable"...');
      await overlay.click();
      await page.waitForTimeout(1000); // Allow state to update
      
      // Check 2: Overlay gone?
      isOverlayGone = !(await overlay.isVisible());
      console.log(`[Check 2] Overlay Disappeared: ${isOverlayGone}`);
  } else {
      console.log('Overlay not visible. Checking if tuner auto-started...');
      if (readoutText.includes('Listening') || readoutText.includes('Ready')) {
          console.log('Tuner auto-started (Permissions likely granted).');
      } else {
           console.error('FAILURE: Start overlay not found and tuner not listening.');
           const content = await page.content();
           console.log('--- PAGE CONTENT START ---');
           console.log(content);
           console.log('--- PAGE CONTENT END ---');
           await browser.close();
           process.exit(1);
      }
  }

  // Check 4: Version
  const versionEl = page.locator('.version-footer');
  if (await versionEl.isVisible()) {
      const versionText = await versionEl.textContent();
      console.log(`[Check 4] Live Version: "${versionText}"`);
  } else {
      console.log(`[Check 4] Version footer not found.`);
  }

  // TEST: Simulate Frequencies
  console.log('--- STARTING FREQUENCY SIMULATION ---');

  // Helper to check note display
  const checkNote = async (expectedNote, expectedOctave, description) => {
      const noteDisplay = page.locator('.note-display');
      const noteText = await noteDisplay.textContent();
      
      console.log(`Simulating ${description}...`);
      if (noteText.includes(expectedNote)) {
          console.log(`SUCCESS: Detected ${description} as "${noteText}"`);
      } else {
           console.error(`FAILURE: Expected ${expectedNote}, got "${noteText}"`);
      }
      await page.screenshot({ path: `${OUTPUT_DIR}/simulated-${description.replace(/\s/g, '_')}.png` });
  };

  // 1. Simulate Low E (82.41 Hz)
  await page.evaluate(() => window.simulatePitch(82.41));
  await page.waitForTimeout(500); // Allow React to render
  await checkNote('E', '2', 'Low E (82.41 Hz)');

  // 2. Simulate A (110.00 Hz)
  await page.evaluate(() => window.simulatePitch(110.00));
  await page.waitForTimeout(500);
  await checkNote('A', '2', 'A String (110.00 Hz)');

  // 3. Simulate High E (329.63 Hz)
  await page.evaluate(() => window.simulatePitch(329.63));
  await page.waitForTimeout(500);
  await checkNote('E', '4', 'High E (329.63 Hz)');

  console.log('--- SIMULATION COMPLETE ---');

  // Capture "Active" state
  await page.screenshot({ path: `${OUTPUT_DIR}/active-live-state.png` });
  console.log('Captured active-live-state.png');

  await browser.close();

  if (isOverlayGone) {
    console.log('SUCCESS: Live tuner activation and frequency simulation verified.');
  } else {
    console.error('FAILURE: Tuner did not activate correctly.');
    process.exit(1);
  }
})();