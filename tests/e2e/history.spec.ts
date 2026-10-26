import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { read, utils, write } from 'xlsx';
import { secondDayRows, SECOND_NAME, ADDED } from '../helpers/secondDay';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;
const day1 = resolve('data/samples/screener-plus-1405-08-04.xlsx');
const outDir = resolve('test-results/fixtures');
const day2 = resolve(outDir, SECOND_NAME);

test.beforeAll(() => {
  mkdirSync(outDir, { recursive: true });
  const wb = read(readFileSync(day1));
  const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, {
    header: 1,
    raw: true,
    defval: null,
  });
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(secondDayRows(rows)), 'Filtered Results');
  writeFileSync(day2, write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
});

const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = p), path);
async function upload(page: Page, file: string, count: string) {
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.locator('.snapshot-date')).toContainText(count, { timeout: 30_000 });
}

test('phase 8: two dated files give Δ scores, newcomers, diff and a risk timeline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${distUrl}#/data-health`);
  await upload(page, day1, '۱۴۰۵/۰۸/۰۴');
  await expect(page.locator('body')).toContainText('اسنپ‌شات قبلی برای مقایسه وجود ندارد');

  await upload(page, day2, '۱۴۰۵/۰۸/۰۵');
  await expect(page.locator('body')).toContainText('تغییرات نسبت به اسنپ‌شات قبل');
  await expect(page.locator('section.card', { hasText: 'نمادهای جدید' })).toContainText(ADDED);

  await go(page, '/profile/technical');
  await expect(page.locator('.tabulator-col', { hasText: 'تغییر نسبت به قبل' })).toBeVisible();
  await expect(
    page.locator('.tabulator-row').first().locator('bdi.pos, bdi.neg, bdi.muted, .faint').first(),
  ).toBeVisible();

  await go(page, '/overview');
  await expect(page.locator('.chip.active', { hasText: ADDED })).toBeVisible();

  await go(page, '/market-risk');
  await expect(
    page.locator('section.card', { hasText: 'روند دماسنج ریسک' }).locator('.chart canvas').first(),
  ).toBeVisible({ timeout: 10_000 });

  // Re-loading the same date asks before replacing the stored snapshot.
  let asked = '';
  page.once('dialog', (d) => {
    asked = d.message();
    void d.accept();
  });
  await page.locator('input[type=file]').setInputFiles(day2);
  await expect.poll(() => asked).toContain('۱۴۰۵/۰۸/۰۵');
  expect(errors).toEqual([]);
});
