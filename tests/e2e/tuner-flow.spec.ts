import { test, expect } from '@playwright/test';

test('Tuner "Tap to Enable" flow works', async ({ page }) => {
  // 1. Navigate to the app
  await page.goto('http://localhost:4173/'); // Vite preview port default

  // 2. Check initial state: "Tap to enable" overlay should be visible
  const overlay = page.locator('.start-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Tap to enable microphone usage');

  // 3. Click the overlay
  // Note: In a real browser this triggers permission prompt. 
  // In Playwright we can pre-grant or handle this. 
  // For now, we assume the click triggers the state change IF permissions allow.
  
  // We need to grant microphone permission context-wide
  const context = page.context();
  await context.grantPermissions(['microphone']);

  await overlay.click();

  // 4. Verify state change
  // The overlay should disappear
  await expect(overlay).not.toBeVisible();

  // The tech readout should say "Listening..." or "Ready" (if mic starts fast)
  // Our code sets status to 'listening' immediately in startTuner
  const readout = page.locator('.tech-readout');
  await expect(readout).toContainText(/Listening|Ready|Hold/);
});
