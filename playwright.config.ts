import { defineConfig, devices } from '@playwright/test';

// This file is now minimal as E2E tests have been removed.
// It can be removed entirely if Playwright is uninstalled.
export default defineConfig({
  testDir: './tests/e2e', // This directory no longer exists
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});