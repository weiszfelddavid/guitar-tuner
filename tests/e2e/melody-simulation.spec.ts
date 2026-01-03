import { test, expect } from '@playwright/test';

test('Tuner correctly detects a melody from a virtual microphone', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // The browser is launched with flags that auto-grant mic permissions 
  // and feed it our pre-generated melody.wav file. The click action by the user
  // is what allows the AudioContext to resume.
  
  // Click the overlay to start the tuner
  await page.locator('.start-overlay').click();

  // Wait for the overlay to disappear, indicating the tuner is active.
  // This is a critical step to ensure the app has started processing audio.
  await expect(page.locator('.start-overlay')).not.toBeVisible({ timeout: 5000 });

  // Add a static wait to ensure the audio worklet has time to initialize and process the first samples
  await page.waitForTimeout(2000);

  // Assert that the UI correctly displays each note from the .wav file in sequence.
  // The timeouts are generous to allow for the audio processing pipeline.
  
  // Note 1: E2 (from melody.wav)
  await expect(page.locator('.note-display-note')).toContainText('E', { timeout: 10000 });

  // Note 2: A2 (from melody.wav)
  await expect(page.locator('.note-display-note')).toContainText('A', { timeout: 10000 });

  // Note 3: D3 (from melody.wav)
  await expect(page.locator('.note-display-note')).toContainText('D', { timeout: 10000 });
  
  // Note 4: G3 (from melody.wav)
  await expect(page.locator('.note-display-note')).toContainText('G', { timeout: 10000 });
});
