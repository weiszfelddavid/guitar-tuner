import { chromium, devices } from 'playwright';

const URL = 'https://tuner.weiszfeld.com/';
const OUTPUT_DIR = 'debug-screenshots';

(async () => {
  const browser = await chromium.launch();

  // --- Mobile (iPhone 13) ---
  const mobileContext = await browser.newContext({
    ...devices['iPhone 13'],
  });
  const mobilePage = await mobileContext.newPage();
  
  // Log console messages
  mobilePage.on('console', msg => console.log(`MOBILE LOG [${msg.type()}]: ${msg.text()}`));
  mobilePage.on('pageerror', err => console.log(`MOBILE ERROR: ${err.message}`));

  console.log(`Navigating to ${URL} on Mobile...`);
  await mobilePage.goto(URL, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000); 

  // Check state
  const diagnostics = await mobilePage.evaluate(() => {
    const wrapper = document.querySelector('.tuner-wrapper');
    const version = document.querySelector('.version-footer')?.textContent;
    const bodyHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    const wrapperStyle = wrapper ? window.getComputedStyle(wrapper) : null;
    
    return {
      wrapperExists: !!wrapper,
      wrapperHeight: wrapperStyle?.height,
      wrapperMinHeight: wrapperStyle?.minHeight,
      version,
      bodyHeight,
      viewportHeight,
      html: document.body.innerHTML.substring(0, 500) // First 500 chars of body
    };
  });

  console.log('Mobile Diagnostics:', diagnostics);
  
  await mobilePage.screenshot({ path: `${OUTPUT_DIR}/mobile-view.png` });
  console.log('Captured mobile-view.png');

  await browser.close();
})();