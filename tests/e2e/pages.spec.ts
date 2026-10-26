import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;
const sample = resolve('data/samples/screener-plus-1405-08-04.xlsx');

async function load(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${distUrl}#/overview`);
  await page.locator('input[type=file]').setInputFiles(sample);
  await expect(page.locator('.snapshot-date')).toContainText('۹۵۷', { timeout: 30_000 });
}

const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = p), path);

test('phase 6: every page renders its charts and follows the global filter', async ({ page }) => {
  const errors: string[] = [];
  await load(page, errors);

  // Overview: KPIs + quadrant + treemap canvases.
  await expect(page.locator('.kpi').first()).toContainText('۹۵۷');
  await expect(page.locator('.chart:has(canvas)')).toHaveCount(2, { timeout: 10_000 });

  // Global filter narrows everything to TSE (431 symbols in the sample).
  await page.locator('.global-filter input').fill('Exchange = "TSE"');
  await page.locator('.global-filter input').press('Enter');
  await expect(page.locator('.kpi').first()).toContainText('۴۳۱');
  await expect(page.locator('.quick-count')).toContainText('۴۳۱');
  await expect(page.locator('.chart:has(canvas)')).toHaveCount(2);

  // Invalid expression is flagged, not applied.
  await page.locator('.global-filter input').fill('NI_MRQQ > 0');
  await page.locator('.global-filter input').press('Enter');
  await expect(page.locator('.global-filter input')).toHaveClass(/invalid/);
  await page.locator('.global-filter input').fill('');
  await page.locator('.global-filter input').press('Enter');

  for (const id of ['technical', 'fundamentalLong', 'fundamentalQuarterly', 'fundamentalMonthly']) {
    await go(page, `/profile/${id}`);
    await expect(page.locator('.tabulator-row').first()).toBeVisible();
    const charts = id === 'fundamentalQuarterly' || id === 'fundamentalMonthly' ? 4 : 3;
    await expect(page.locator('.chart:has(canvas)')).toHaveCount(charts, { timeout: 10_000 });
  }

  await go(page, '/market-risk');
  await expect(page.locator('.chart:has(canvas)')).toHaveCount(4, { timeout: 10_000 });

  // Row click opens the stock drawer with radars.
  await go(page, '/profile/technical');
  await page.locator('.tabulator-row').first().click();
  await expect(page.locator('.drawer')).toBeVisible();
  await expect(page.locator('.drawer .chart canvas').first()).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.drawer')).toBeHidden();

  expect(errors).toEqual([]);
});

test('weight preset change rescoring keeps the page working', async ({ page }) => {
  const errors: string[] = [];
  await load(page, errors);
  await go(page, '/profile/technical');
  const firstScore = page.locator('.tabulator-row').first().locator('.score-badge');
  await expect(firstScore).toBeVisible();
  const before = await firstScore.textContent();
  await page.locator('.page-head select').first().selectOption('conservative');
  await expect(firstScore).not.toHaveText(before ?? '', { timeout: 10_000 });
  expect(errors).toEqual([]);
});
