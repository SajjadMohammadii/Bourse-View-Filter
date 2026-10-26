import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // Each test loads a ~1k-symbol workbook; running serially keeps timings deterministic.
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    locale: 'fa-IR',
    viewport: { width: 1440, height: 900 },
  },
  reporter: [['list']],
});
