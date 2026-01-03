import { test, expect } from '@playwright/test';

test.describe('Sound Level Indicator', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock
    await page.addInitScript(() => {
      window.mockPort = { onmessage: null };
      const OriginalAudioWorkletNode = window.AudioWorkletNode;
      window.AudioWorkletNode = class MockAudioWorkletNode extends OriginalAudioWorkletNode {
        constructor(context, name) {
          super(context, name);
          const actualPort = this.port;
          Object.defineProperty(this, 'port', {
            get: () => ({
              ...actualPort,
              set onmessage(cb) { window.mockPort.onmessage = cb; },
              get onmessage() { return window.mockPort.onmessage; }
            })
          });
        }
      };
      window.simulateAudio = (rms) => {
        if (window.mockPort.onmessage) {
          window.mockPort.onmessage({ data: { pitch: null, clarity: 0, bufferrms: rms } });
        }
      };
    });

    await page.goto('/');
    // Grant permissions (simulated by clicking overlay if needed, or if granted via context)
    // For local preview, we might need to handle overlay.
    // Playwright config doesn't set permissions by default.
    
    // We can just click the overlay.
    const overlay = page.locator('.start-overlay');
    if (await overlay.isVisible()) {
      await overlay.click();
    }
  });

  test('should expand bar on volume input', async ({ page }) => {
    const indicator = page.locator('.sound-level-indicator');
    await expect(indicator).toBeVisible();

    // Initial state: width 0 or small?
    // Volume 0 -> width 0%
    await page.evaluate(() => window.simulateAudio(0));
    await expect(indicator).toHaveCSS('width', '0px');

    // Simulate volume
    // bufferrms = 0.1 -> displayVolume = 0.5 (min(1, 0.1 * 5)) -> 50%
    // We need to check style.width.
    // Playwright `toHaveCSS` checks computed style in px usually.
    // Let's verify style attribute or approximate width.
    
    await page.evaluate(() => window.simulateAudio(0.1));
    // Wait for react render
    await page.waitForTimeout(100);
    
    // Check if width is roughly 50% of parent (tuner-main-display).
    // Easier: Check if style attribute contains '50%'.
    await expect(indicator).toHaveAttribute('style', /width: 50%/);
    
    // Check active color/opacity
    // opacity: 0.6
    await expect(indicator).toHaveCSS('opacity', '0.6');
  });
});
