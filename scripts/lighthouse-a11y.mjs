/**
 * Lighthouse accessibility audit of every page WITH data loaded (PLAN.md §15 phase 9: score ≥ 90).
 * Usage: npm run build && npm run audit:a11y   (serves dist/ on localhost:4179 only for the audit)
 * The sample file is loaded once into a persistent Chrome profile; the app restores it from
 * IndexedDB on every navigation, so Lighthouse audits the populated pages.
 */
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { preview } from 'vite';

const PORT = 9333;
const MIN_SCORE = 90;
// Lighthouse refuses file:// URLs, so the built single file is served locally just for the audit.
const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'silent' });
const url = 'http://localhost:4179/index.html';
const sample = resolve('data/samples/screener-plus-1405-08-04.xlsx');
const routes = [
  '/overview', '/profile/technical', '/market-risk', '/profile/fundamentalLong', '/profile/fundamentalQuarterly',
  '/profile/fundamentalMonthly', '/filter-studio', '/custom-metrics', '/raw-data', '/data-health', '/settings',
];

const profile = mkdtempSync(join(tmpdir(), 'bvf-lh-'));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  headless: true,
  args: [`--remote-debugging-port=${PORT}`, '--allow-file-access-from-files'],
});
const page = await ctx.newPage();
await page.goto(`${url}#/overview`);
await page.locator('input[type=file]').setInputFiles(sample);
await page.waitForSelector('.snapshot-date:has-text("۹۵۷")', { timeout: 60_000 });
await page.waitForTimeout(1500);

let failed = false;
for (const route of routes) {
  const result = await lighthouse(`${url}#${route}`, {
    port: PORT,
    onlyCategories: ['accessibility'],
    disableStorageReset: true,
    output: 'json',
    logLevel: 'error',
  });
  const score = Math.round((result?.lhr.categories.accessibility.score ?? 0) * 100);
  const issues = Object.values(result?.lhr.audits ?? {})
    .filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary')
    .map((a) => a.id);
  console.log(`${score >= MIN_SCORE ? '✓' : '✗'} ${String(score).padStart(3)}  ${route}${issues.length ? `  (${issues.join(', ')})` : ''}`);
  if (score < MIN_SCORE) failed = true;
}
await ctx.close();
await server.close();
rmSync(profile, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
