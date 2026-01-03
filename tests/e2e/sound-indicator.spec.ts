import { test, expect } from '@playwright/test';

test.describe('Sound Level Indicator', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await page.addInitScript(() => {
      window.mockPort = { onmessage: null };
      const OriginalAudioWorkletNode = window.AudioWorkletNode;
      window.AudioWorkletNode = class MockAudioWorkletNode extends OriginalAudioWorkletNode {
        constructor(context, name, options) {
          super(context, name, options);
          this.port = window.mockPort;
        }
      };
      window.simulateAudio = (rms) => {
        if (window.mockPort.onmessage) {
          window.mockPort.onmessage({ data: { pitch: null, clarity: 0, bufferrms: rms } });
        }
      };
    });
    await page.goto('/');
    const overlay = page.locator('.start-overlay');
    await overlay.click();
    await overlay.waitFor({ state: 'hidden' });
  });

  test('should expand bar on volume input', async ({ page }) => {
    const indicator = page.locator('.sound-level-indicator');
    await expect(indicator).toBeAttached();

    await page.evaluate(() => window.simulateAudio(0));
    await expect(indicator).toHaveCSS('width', '0px');

    await page.evaluate(() => window.simulateAudio(0.1));
    await expect(indicator).toHaveAttribute('style', /width: 50%/);
    await expect(indicator).toHaveCSS('opacity', '0.6');
  });
});
