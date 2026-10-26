import { describe, it, expect } from 'vitest';
import {
  compile,
  catalogFromDataset,
  runFilter,
  evaluateNumeric,
  completions,
  defaultConstants,
} from '../../../src/core/filters';
import { miniDataset } from '../../helpers/mini';
import type { Dataset } from '../../../src/core/types';

const ds: Dataset = miniDataset([
  {
    Symbol: 'الف',
    Exchange: 'TSE',
    Sector: 'مالی',
    Industry: 'بانک',
    Company: 'بانک ملت',
    a: 10,
    b: 2,
    c: null,
    NI_MRQ: 40,
    NI_FY: 100,
    g: 0.5,
  },
  {
    Symbol: 'ب',
    Exchange: 'IFB',
    Sector: 'مالی',
    Industry: 'بیمه',
    Company: 'بیمه البرز',
    a: 20,
    b: 0,
    c: 1,
    NI_MRQ: 10,
    NI_FY: 100,
    g: 0.35,
  },
  {
    Symbol: 'پ',
    Exchange: 'OTC',
    Sector: 'صنعت',
    Industry: 'فولاد',
    Company: 'فولاد مبارکه',
    a: 30,
    b: -1,
    c: 2,
    NI_MRQ: -5,
    NI_FY: 100,
    g: null,
  },
  {
    Symbol: 'ت',
    Exchange: 'TSE',
    Sector: 'صنعت',
    Industry: 'فولاد',
    Company: '',
    a: null,
    b: 5,
    c: 3,
    NI_MRQ: 50,
    NI_FY: -10,
    g: 0.1,
  },
]);
ds.num['NB'] = Float64Array.from([-Infinity, 1, 2, 3]);
ds.num['flag.x'] = Float64Array.from([1, 0, NaN, 1]);
ds.meta['flag.x'] = { ...ds.meta['a']!, id: 'flag.x', unit: 'flag' };
ds.num['OP-Margin-MRQ-3qGR'] = Float64Array.from([0.1, 0.2, 0.3, 0.4]);
ds.meta['OP-Margin-MRQ-3qGR'] = { ...ds.meta['a']!, id: 'OP-Margin-MRQ-3qGR' };

const catalog = catalogFromDataset(ds, defaultConstants(0.35, 0.3));
const ctx = { ds, inflation: 0.35, constants: defaultConstants(0.35, 0.3) };

function rows(src: string): string[] {
  const c = compile(src, catalog);
  if (!c.ok) throw new Error(c.error.message);
  const mask = runFilter(c.value, ctx);
  return ds.symbols.filter((_, i) => mask[i]);
}
function values(src: string): number[] {
  const c = compile(src, catalog);
  if (!c.ok) throw new Error(c.error.message);
  return [...evaluateNumeric(c.value, ctx)].map((v) => (Number.isNaN(v) ? NaN : Math.round(v * 1e6) / 1e6));
}
function error(src: string) {
  const c = compile(src, catalog);
  if (c.ok) throw new Error('expected error');
  return c.error;
}

describe('evaluator: comparisons and logic', () => {
  it('numeric comparison', () => expect(rows('a > 15')).toEqual(['ب', 'پ']));
  it('comparison with null is false', () => expect(rows('a < 100')).toEqual(['الف', 'ب', 'پ']));
  it('NOT of a null comparison is true (two-valued logic)', () => expect(rows('NOT a < 100')).toEqual(['ت']));
  it('AND / OR', () => {
    expect(rows('a > 5 AND b > 0')).toEqual(['الف']);
    expect(rows('a > 25 OR b > 4')).toEqual(['پ', 'ت']);
  });
  it('!= and = on numbers', () => {
    expect(rows('b = 0')).toEqual(['ب']);
    expect(rows('b != 0')).toEqual(['الف', 'پ', 'ت']);
  });
  it('text equality and inequality (empty text is null)', () => {
    expect(rows('Exchange = "TSE"')).toEqual(['الف', 'ت']);
    expect(rows('Company != "بانک ملت"')).toEqual(['ب', 'پ']);
  });
  it('IN / NOT IN for text and numbers', () => {
    expect(rows('Exchange IN ("TSE","IFB")')).toEqual(['الف', 'ب', 'ت']);
    expect(rows('Exchange NOT IN ("TSE")')).toEqual(['ب', 'پ']);
    expect(rows('b IN (0, 5, -1)')).toEqual(['ب', 'پ', 'ت']);
  });
  it('BETWEEN is inclusive and null-safe; NOT BETWEEN', () => {
    expect(rows('a BETWEEN 10 AND 20')).toEqual(['الف', 'ب']);
    expect(rows('a NOT BETWEEN 10 AND 20')).toEqual(['پ']);
  });
  it('CONTAINS', () => expect(rows('Company CONTAINS "فولاد"')).toEqual(['پ']));
  it('IS NULL / IS NOT NULL on numbers and text', () => {
    expect(rows('c IS NULL')).toEqual(['الف']);
    expect(rows('Company IS NOT NULL')).toEqual(['الف', 'ب', 'پ']);
  });
  it('flags behave as booleans', () => {
    expect(rows('flag.x')).toEqual(['الف', 'ت']);
    expect(rows('NOT flag.x')).toEqual(['ب', 'پ']);
    expect(rows('flag.x = 1')).toEqual(['الف', 'ت']);
  });
  it('NEGATIVE_BASE behaves as null', () => {
    expect(rows('NB < 100')).toEqual(['ب', 'پ', 'ت']);
    expect(rows('NB IS NULL')).toEqual(['الف']);
  });
  it('Persian keywords and digits', () => expect(rows('a > ۱۵ و Exchange = "OTC"')).toEqual(['پ']));
  it('percent literals', () => expect(rows('NI_MRQ / NI_FY > 35%')).toEqual(['الف']));
  it('hyphenated column names with and without brackets', () => {
    expect(rows('[OP-Margin-MRQ-3qGR] > 0.25')).toEqual(['پ', 'ت']);
    expect(rows('OP-Margin-MRQ-3qGR > 0.25')).toEqual(['پ', 'ت']);
  });
  it('case-insensitive field fallback', () => expect(rows('A > 25')).toEqual(['پ']));
  it('a bare numeric expression filters on non-zero', () => expect(rows('b')).toEqual(['الف', 'پ', 'ت']));
});

describe('evaluator: arithmetic and null propagation', () => {
  it('basic arithmetic', () => expect(values('a * 2 + 1')).toEqual([21, 41, 61, NaN]));
  it('division by zero yields null', () => expect(values('a / b')).toEqual([5, NaN, -30, NaN]));
  it('modulo and power', () => {
    expect(values('a % 7')).toEqual([3, 6, 2, NaN]);
    expect(values('2 ^ 3 ^ 2')[0]).toBe(512);
  });
  it('unary minus', () => expect(values('-a')).toEqual([-10, -20, -30, NaN]));
  it('constants INFLATION and RISK_FREE', () => expect(values('INFLATION + RISK_FREE')[0]).toBe(0.65));
  it('booleans become 0/1 in arithmetic', () => expect(values('(a > 15) * 10')).toEqual([0, 10, 10, 0]));
});

describe('function library', () => {
  it('abs / sign / round / floor / ceil', () => {
    expect(values('abs(b)')).toEqual([2, 0, 1, 5]);
    expect(values('sign(b)')).toEqual([1, 0, -1, 1]);
    expect(values('round(g * 100 / 3, 1)')).toEqual([16.7, 11.7, NaN, 3.3]);
    expect(values('floor(g * 10)')).toEqual([5, 3, NaN, 1]);
    expect(values('ceil(g * 10)')).toEqual([5, 4, NaN, 1]);
  });
  it('min / max ignore nulls', () => {
    expect(values('min(a, c)')).toEqual([10, 1, 2, 3]);
    expect(values('max(a, c)')).toEqual([10, 20, 30, 3]);
  });
  it('log / ln / sqrt / pow guard their domains', () => {
    expect(values('log(a)')[0]).toBe(1);
    expect(values('ln(b)')).toEqual([
      Math.round(Math.log(2) * 1e6) / 1e6,
      NaN,
      NaN,
      Math.round(Math.log(5) * 1e6) / 1e6,
    ]);
    expect(values('sqrt(b)')[2]).toBeNaN();
    expect(values('pow(b, 2)')).toEqual([4, 0, 1, 25]);
  });
  it('clamp', () => expect(values('clamp(a, 15, 25)')).toEqual([15, 20, 25, NaN]));
  it('coalesce / ifnull / isnull', () => {
    expect(values('coalesce(a, c, 0)')).toEqual([10, 20, 30, 3]);
    expect(values('ifnull(c, -1)')).toEqual([-1, 1, 2, 3]);
    expect(rows('isnull(a)')).toEqual(['ت']);
  });
  it('if with numeric and text branches', () => {
    expect(values('if(a > 15, 1, 0)')).toEqual([0, 1, 1, 0]);
    expect(rows('if(a > 15, Exchange, "x") = "IFB"')).toEqual(['ب']);
  });
  it('safe_div', () => expect(values('safe_div(a, b)')).toEqual([5, NaN, -30, NaN]));
  it('real() deflates growth, with periods', () => {
    expect(values('real(g)')).toEqual([
      Math.round((1.5 / 1.35 - 1) * 1e6) / 1e6,
      0,
      NaN,
      Math.round((1.1 / 1.35 - 1) * 1e6) / 1e6,
    ]);
    expect(values('real(0, 4)')[0]).toBeCloseTo(1 / Math.pow(1.35, 0.25) - 1, 6);
  });
  it('annualize and cagr', () => {
    expect(values('annualize(0.1, 4)')[0]).toBeCloseTo(0.4641, 4);
    expect(values('cagr(121, 100, 2)')[0]).toBeCloseTo(0.1, 6);
    expect(values('cagr(-1, 100, 2)')[0]).toBeNaN();
  });
  it('pct_rank / rank / top_n over the market', () => {
    expect(values('pct_rank(a)')).toEqual([0, 50, 100, NaN]);
    expect(values('rank(a)')).toEqual([3, 2, 1, NaN]);
    expect(rows('top_n(a, 2)')).toEqual(['ب', 'پ']);
  });
  it('sector and industry aggregates', () => {
    expect(values('sector_avg(a)')).toEqual([15, 15, 30, 30]);
    expect(values('sector_median(b)')).toEqual([1, 1, 2, 2]);
    expect(values('sector_pct(b)')).toEqual([100, 0, 0, 100]);
    expect(values('industry_pct(b)')).toEqual([50, 50, 0, 100]);
    expect(values('industry_median(b)')).toEqual([2, 0, 2, 2]);
  });
  it('zscore', () => {
    const z = values('zscore(a)');
    expect(z[1]).toBe(0);
    expect(z[0]).toBeCloseTo(-1, 6);
  });
  it('contains / starts_with functions', () => {
    expect(rows('contains(Company, "بیمه")')).toEqual(['ب']);
    expect(rows('starts_with(Company, "بانک")')).toEqual(['الف']);
  });
  it('function names are case-insensitive', () => expect(values('ABS(b)')[2]).toBe(1));
});

describe('analyzer errors (Persian, with suggestions)', () => {
  it('unknown column suggests the closest name', () => {
    const e = error('NI_MRQQ > 0');
    expect(e.message).toBe('ستون «NI_MRQQ» پیدا نشد. منظورتان «NI_MRQ» است؟');
    expect(e.details).toMatchObject({ start: 0, end: 7, suggestion: 'NI_MRQ' });
  });
  it('unknown function suggests the closest function', () =>
    expect(error('rond(a) > 1').message).toContain('round'));
  it('wrong arity', () => expect(error('abs(a, b) > 1').message).toContain('abs(x)'));
  it('text vs number comparison', () => expect(error('Exchange > 5').message).toContain('متنی'));
  it('text in arithmetic', () => expect(error('Exchange + 1 > 0').message).toContain('عددی'));
  it('CONTAINS on numbers', () => expect(error('a CONTAINS "x"').message).toContain('متنی'));
  it('= null suggests IS NULL', () => expect(error('a = null').message).toContain('IS NULL'));
  it('IN with non-literals', () => expect(error('a IN (b)').message).toContain('IN'));
  it('syntax errors surface as Result errors with positions', () => {
    const e = error('a > > 1');
    expect(e.code).toBe('FILTER_SYNTAX');
    expect(e.details).toMatchObject({ start: 4 });
  });
});

describe('completions', () => {
  it('suggests fields, functions and keywords', () => {
    const labels = completions('ab', catalog, () => undefined).map((c) => c.label);
    expect(labels).toContain('abs(');
    expect(completions('NI_', catalog, () => undefined).map((c) => c.label)).toEqual(
      expect.arrayContaining(['NI_MRQ', 'NI_FY']),
    );
    expect(completions('bet', catalog, () => undefined)[0]?.label).toBe('BETWEEN');
  });
  it('matches Persian labels', () => {
    expect(
      completions('سود', catalog, (id) => (id === 'NI_MRQ' ? 'سود خالص فصل' : undefined))[0]?.label,
    ).toBe('NI_MRQ');
  });
});
