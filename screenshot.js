const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');

(async () => {
  // 1. Start Vite Preview Server
  console.log('Starting server...');
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4173']);
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 12 Pro
    deviceScaleFactor: 3
  });
  const page = await context.newPage();

  try {
    console.log('Navigating...');
    await page.goto('http://localhost:4173');
    
    // Screenshot Start Screen
    await page.screenshot({ path: 'screenshot-start.png' });
    console.log('Captured start screen.');

    // Click Start
    await page.click('#start-btn');
    
    // Wait for canvas to render (simulated delay for audio setup)
    await page.waitForTimeout(1000);
    
    // Screenshot Tuner UI
    await page.screenshot({ path: 'screenshot-ui.png' });
    console.log('Captured UI.');

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
    server.kill();
    process.exit(0);
  }
})();
