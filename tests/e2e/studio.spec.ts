import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;
const sample = resolve('data/samples/screener-plus-1405-08-04.xlsx');
const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = p), path);

async function load(page: Page) {
  await page.goto(`${distUrl}#/overview`);
  await page.locator('input[type=file]').setInputFiles(sample);
  await expect(page.locator('.snapshot-date')).toContainText('۹۵۷', { timeout: 30_000 });
}

test('phase 7: custom metric C_QtrShare → column, filter, factor Q1, survives refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page);

  await go(page, '/custom-metrics');
  await page.getByRole('button', { name: /پارامتر جدید/ }).click();
  await page.getByLabel('شناسه (با C_ شروع می‌شود)').fill('QtrShare');
  await page.getByLabel('عنوان فارسی').fill('سهم فصل از سود سال');
  await page.locator('.expr-editor textarea').fill('NI_MRQ / NI_FY');
  await expect(page.locator('.mini-hist')).toBeVisible();
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.locator('table.simple-table')).toContainText('C_QtrShare');

  // Add to factor Q1 of the quarterly profile.
  await page.getByRole('button', { name: 'افزودن', exact: true }).click();
  await expect(page.locator('table.simple-table')).toContainText('Q1', { timeout: 10_000 });

  // Column in the raw table.
  await go(page, '/raw-data');
  await page.locator('.card select').first().selectOption('C_QtrShare');
  await expect(page.locator('.tabulator-col[tabulator-field="C_QtrShare"]')).toBeVisible();

  // Filter on it.
  await page.locator('.global-filter input').fill('C_QtrShare > 0.35');
  await page.locator('.global-filter input').press('Enter');
  await expect(page.locator('.quick-count')).not.toContainText('۹۵۷ نماد از');
  await expect(page.locator('.quick-count')).toContainText('نماد از ۹۵۷');

  // Refresh: file, metric and factor edit are restored from IndexedDB.
  await page.reload();
  await expect(page.locator('.snapshot-date')).toContainText('۹۵۷', { timeout: 30_000 });
  await go(page, '/custom-metrics');
  await expect(page.locator('table.simple-table')).toContainText('C_QtrShare');
  await expect(page.locator('table.simple-table')).toContainText('Q1');
  await go(page, '/raw-data');
  await page.locator('.global-filter input').fill('C_QtrShare > 0.35');
  await page.locator('.global-filter input').press('Enter');
  await expect(page.locator('.global-filter input')).not.toHaveClass(/invalid/);
  expect(errors).toEqual([]);
});

test('filter studio: builder writes text, text fills the builder, presets load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page);
  await go(page, '/filter-studio');
  const text = page.locator('.expr-editor textarea');

  await page.getByRole('button', { name: '+ شرط' }).click();
  await page.locator('.builder-cond select').first().selectOption('score.technical');
  await page.locator('.builder-cond input[type=number]').first().fill('60');
  await page.locator('.builder-cond input[type=number]').first().dispatchEvent('change');
  await expect(text).toHaveValue('score.technical > 60');

  await text.fill('Exchange IN ("TSE", "IFB") AND score.fundamentalLong >= 70');
  await expect(page.locator('.builder-cond')).toHaveCount(2);

  await text.fill('NI_MRQQ > 0');
  await expect(page.locator('.expr-editor .error-box')).toContainText('NI_MRQ');

  await page.getByRole('button', { name: 'کم‌ریسک بنیادی قوی' }).click();
  await expect(text).toHaveValue(/factor\.technical\.T5/);
  await expect(page.locator('.tabulator-row').first()).toBeVisible();
  expect(errors).toEqual([]);
});
