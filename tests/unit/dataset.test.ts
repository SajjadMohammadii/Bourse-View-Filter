import { describe, it, expect } from 'vitest';
import { processRows } from '../../src/app/pipeline';

const header = ['', 'Company', 'Symbol', 'Sector', 'Industry', 'Exchange', 'Price', 'MarketCap', 'NI_TTM\n'];
const row = (sym: string, price: unknown = 100): unknown[] => [
  null,
  'شرکت',
  sym,
  'مواد پایه',
  'آهن و فولاد',
  'TSE',
  price,
  1e12,
  '-',
];

function run(rows: unknown[][]) {
  const r = processRows(rows, { fileName: 'screener-plus-1405-08-04.xlsx' });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('buildDataset resilience', () => {
  it('drops the empty unnamed column, normalizes names and maps "-" to null', () => {
    const { dataset, report } = run([header, row('الف'), row('ب')]);
    expect(dataset.size).toBe(2);
    expect(report.droppedColumns).toHaveLength(1);
    expect(dataset.num['NI_TTM']?.every(Number.isNaN)).toBe(true);
    expect(dataset.snapshotDate).toEqual({ y: 1405, m: 8, d: 4 });
  });

  it('handles reordered columns', () => {
    const order = [2, 1, 6, 0, 3, 4, 5, 7, 8];
    const reorder = (r: unknown[]) => order.map((i) => r[i]);
    const { dataset } = run([reorder(header), reorder(row('الف', 55))]);
    expect(dataset.num['Price']?.[0]).toBe(55);
  });

  it('accepts a new unknown column and makes it usable', () => {
    const { dataset, report } = run([
      [...header, 'BrandNew'],
      [...row('الف'), 7],
    ]);
    expect(report.unknownColumns).toContain('BrandNew');
    expect(dataset.meta['BrandNew']?.category).toBe('uncategorized');
    expect(dataset.num['BrandNew']?.[0]).toBe(7);
  });

  it('reports a removed required column without crashing', () => {
    const cut = (r: unknown[]) => r.filter((_, i) => i !== 6);
    const { dataset, report } = run([cut(header), cut(row('الف'))]);
    expect(dataset.num['Price']).toBeUndefined();
    expect(report.missingRequired).toContain('Price');
  });

  it('keeps the first of duplicate symbols and warns', () => {
    const { dataset, report } = run([header, row('الف', 1), row('الف', 2), row('ب')]);
    expect(dataset.symbols).toEqual(['الف', 'ب']);
    expect(dataset.num['Price']?.[0]).toBe(1);
    expect(report.duplicateSymbols).toEqual(['الف']);
  });

  it('copes with an almost empty file', () => {
    const r = processRows([header], { fileName: 'x.xlsx' });
    expect(r.ok).toBe(false);
  });

  it('fails clearly when Symbol is missing', () => {
    const r = processRows([['Price'], [1]], { fileName: 'x.xlsx' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_SYMBOL');
  });

  it('replaces an unknown sector with the "unknown" label and counts non-numeric cells', () => {
    const bad = row('ج', 'abc');
    bad[3] = '-';
    const { dataset, report } = run([header, bad]);
    expect(dataset.text['Sector']?.[0]).toBe('نامشخص');
    expect(report.noSectorSymbols).toEqual(['ج']);
    expect(report.nonNumericCells).toBe(1);
  });
});
