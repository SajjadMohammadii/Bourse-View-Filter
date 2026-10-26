import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    locale: 'fa-IR',
    viewport: { width: 1440, height: 900 },
  },
  reporter: [['list']],
});
