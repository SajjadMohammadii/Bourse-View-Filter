import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;
const sample = resolve('data/samples/screener-plus-1405-08-04.xlsx');

test('single-file build opens offline from file://', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(distUrl);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.nav a').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('loads the sample file and shows data health + raw table', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${distUrl}#/data-health`);
  await page.locator('input[type=file]').setInputFiles(sample);
  await expect(page.locator('.snapshot-date')).toContainText('۹۵۷', { timeout: 20_000 });
  await expect(page.locator('.kpi').first()).toContainText('۹۵۷');
  await page.goto(`${distUrl}#/raw-data`);
  await expect(page.locator('.tabulator-row').first()).toBeVisible();
  expect(errors).toEqual([]);
});
