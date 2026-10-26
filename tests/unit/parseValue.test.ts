import { describe, it, expect } from 'vitest';
import { parseCell, parseNumber } from '../../src/core/data/parseValue';
import { toLatinDigits } from '../../src/core/utils/digits';

describe('parseCell', () => {
  it.each(['-', '----', '', '  ', 'N/A', 'nan', null, undefined])('treats %j as null', (v) => {
    expect(parseCell(v)).toEqual({ kind: 'null' });
  });
  it('keeps finite numbers', () => {
    expect(parseCell(0.1305)).toEqual({ kind: 'num', value: 0.1305 });
    expect(parseCell(-3)).toEqual({ kind: 'num', value: -3 });
  });
  it('drops non-finite numbers', () => {
    expect(parseCell(Infinity)).toEqual({ kind: 'null' });
    expect(parseCell(NaN)).toEqual({ kind: 'null' });
  });
  it('parses numeric strings with separators, Persian digits and percents', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('۱۲٫۵')).toBe(12.5);
    expect(parseNumber('13.05%')).toBeCloseTo(0.1305);
    expect(parseNumber('۲۰٪')).toBeCloseTo(0.2);
    expect(parseNumber('1e3')).toBe(1000);
  });
  it('returns text for non-numeric strings', () => {
    expect(parseCell('  مواد   پایه ')).toEqual({ kind: 'text', value: 'مواد پایه' });
    expect(parseNumber('abc')).toBeNull();
  });
  it('maps booleans to 0/1', () => {
    expect(parseNumber(true)).toBe(1);
  });
});

describe('toLatinDigits', () => {
  it('converts Persian and Arabic digits', () => {
    expect(toLatinDigits('۱۴۰۵-۰۸-٠٤')).toBe('1405-08-04');
  });
});
