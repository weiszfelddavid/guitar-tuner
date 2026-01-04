import { test, expect } from '@playwright/test';

test('Tuner correctly detects a melody from a virtual microphone', async ({ page }) => {
  // Navigate to the app. Playwright is configured to auto-grant mic permissions
  // and feed a pre-generated .wav file as the audio input.
  await page.goto('/');

  // The click action by the test is what allows the AudioContext to be resumed.
  await page.locator('.start-overlay').click();

  // Wait for the overlay to disappear, indicating the tuner is active.
  await expect(page.locator('.start-overlay')).not.toBeVisible({ timeout: 5000 });

  // Add a static wait to ensure the audio worklet has time to initialize 
  // and process the first note from the .wav file.
  await page.waitForTimeout(2000);

  // Assert that the UI correctly displays each note from the .wav file in sequence.
  
  // Note 1: E2
  await expect(page.locator('.note-display-note')).toContainText('E', { timeout: 10000 });

  // Note 2: A2
  await expect(page.locator('.note-display-note')).toContainText('A', { timeout: 10000 });

  // Note 3: D3
  await expect(page.locator('.note-display-note')).toContainText('D', { timeout: 10000 });
  
  // Note 4: G3
  await expect(page.locator('.note-display-note')).toContainText('G', { timeout: 10000 });
});
