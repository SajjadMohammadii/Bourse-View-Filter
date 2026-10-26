import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const distUrl = pathToFileURL(resolve('dist/index.html')).href;
const sample = resolve('data/samples/screener-plus-1405-08-04.xlsx');
const ROUTES = [
  '/overview',
  '/profile/technical',
  '/market-risk',
  '/profile/fundamentalLong',
  '/profile/fundamentalQuarterly',
  '/profile/fundamentalMonthly',
  '/filter-studio',
  '/custom-metrics',
  '/raw-data',
  '/data-health',
  '/settings',
];
const go = (page: Page, path: string) => page.evaluate((p) => (location.hash = p), path);

test('accessibility: no serious or critical axe violations on any page', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${distUrl}#/overview`);
  await page.locator('input[type=file]').setInputFiles(sample);
  await expect(page.locator('.snapshot-date')).toContainText('۹۵۷', { timeout: 30_000 });
  const report: string[] = [];
  for (const route of ROUTES) {
    await go(page, route);
    await page.waitForTimeout(1200);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const v of result.violations) {
      if (v.impact === 'serious' || v.impact === 'critical') {
        report.push(
          `${route} [${v.impact}] ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')} — ${v.nodes[0]?.failureSummary?.split('\n')[1] ?? ''}`,
        );
      }
    }
  }
  expect(report, report.join('\n')).toEqual([]);
});
