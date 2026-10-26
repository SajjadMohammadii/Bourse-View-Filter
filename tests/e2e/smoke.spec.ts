import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;

test('single-file build opens offline from file://', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(distUrl);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.nav a').first()).toBeVisible();
  expect(errors).toEqual([]);
});
