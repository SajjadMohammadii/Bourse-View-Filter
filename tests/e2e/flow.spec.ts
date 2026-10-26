import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;
const sample = resolve('data/samples/screener-plus-1405-08-04.xlsx');
const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = p), path);

/** PLAN.md §14.2 E2E: load → 957 → preset → custom metric + filter → stock details → export. */
test('full user flow with exports', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${distUrl}#/overview`);
  // Realistic timing: the user opens the app, then picks the file (worker already started).
  await page.waitForTimeout(1500);

  const t0 = Date.now();
  await page.locator('input[type=file]').setInputFiles(sample);
  await expect(page.locator('.snapshot-date')).toContainText('۹۵۷', { timeout: 30_000 });
  const loadMs = Date.now() - t0;
  console.log(`full sample load in the browser: ${loadMs} ms`);
  test.info().annotations.push({ type: 'load-ms', description: String(loadMs) });
  // PLAN.md §15 phase 9: < 2 s on a typical laptop (measured ≈1.5 s on a 2015 i5-6200U).
  expect(loadMs).toBeLessThan(2000);

  // Apply a built-in preset from the studio.
  await go(page, '/filter-studio');
  await page.getByRole('button', { name: 'ورود پول حقیقی در روند' }).click();
  await page.getByRole('button', { name: 'اعمال به فیلتر سراسری' }).click();
  await expect(page.locator('.global-filter input')).toHaveValue(/flag\.smartMoneyIn/);
  const narrowed = await page.locator('.quick-count').textContent();
  expect(narrowed).not.toContain('۹۵۷ نماد از');

  // Custom metric used in a filter.
  await page.locator('.global-filter input').fill('');
  await page.locator('.global-filter input').press('Enter');
  await go(page, '/custom-metrics');
  await page.getByRole('button', { name: /پارامتر جدید/ }).click();
  await page.getByLabel('شناسه (با C_ شروع می‌شود)').fill('DebtToRevQ');
  await page.locator('.expr-editor textarea').fill('DebtRatio * TA_MRQ / (Rev_MRQ * 4)');
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.locator('table.simple-table')).toContainText('C_DebtToRevQ');
  await page.locator('.global-filter input').fill('C_DebtToRevQ < 0.2 AND score.fundamentalQuarterly > 60');
  await page.locator('.global-filter input').press('Enter');
  await expect(page.locator('.global-filter input')).not.toHaveClass(/invalid/, { timeout: 10_000 });

  // Stock details from a profile table, then export the table to Excel.
  await go(page, '/profile/fundamentalQuarterly');
  await page.locator('.tabulator-row').first().click();
  await expect(page.locator('.drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  const [xlsx] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'خروجی Excel' }).click(),
  ]);
  expect(xlsx.suggestedFilename()).toMatch(/^fundamentalQuarterly-.*\.xlsx$/);

  // Studio CSV export of the current results.
  await go(page, '/filter-studio');
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'خروجی CSV' }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect(errors).toEqual([]);
});
