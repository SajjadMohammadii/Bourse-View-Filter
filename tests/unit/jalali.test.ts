import { describe, it, expect } from 'vitest';
import {
  daysBetween,
  fromCompact,
  isValidJalali,
  jalaliToJdn,
  compareJalali,
} from '../../src/core/utils/jalali';
import { snapshotDateFromFileName } from '../../src/core/data/snapshotDate';

describe('jalali', () => {
  it('maps 1 Farvardin 1403 to the right Julian day (2024-03-20)', () => {
    expect(jalaliToJdn({ y: 1403, m: 1, d: 1 })).toBe(2460390);
  });
  it('counts days across month lengths', () => {
    expect(daysBetween({ y: 1405, m: 6, d: 31 }, { y: 1405, m: 8, d: 4 })).toBe(34);
    expect(daysBetween({ y: 1404, m: 12, d: 29 }, { y: 1405, m: 1, d: 1 })).toBe(1);
  });
  it('handles leap Esfand', () => {
    expect(isValidJalali({ y: 1403, m: 12, d: 30 })).toBe(true);
    expect(isValidJalali({ y: 1404, m: 12, d: 30 })).toBe(false);
  });
  it('parses compact dates', () => {
    expect(fromCompact(14050631)).toEqual({ y: 1405, m: 6, d: 31 });
    expect(fromCompact(14051399)).toBeNull();
    expect(fromCompact(NaN)).toBeNull();
  });
  it('compares dates', () => {
    expect(compareJalali({ y: 1405, m: 1, d: 2 }, { y: 1405, m: 1, d: 1 })).toBeGreaterThan(0);
  });
});

describe('snapshotDateFromFileName', () => {
  it('extracts the Jalali date', () => {
    expect(snapshotDateFromFileName('screener-plus-1405-08-04.xlsx')).toEqual({ y: 1405, m: 8, d: 4 });
    expect(snapshotDateFromFileName('screener-plus-۱۴۰۵-۰۸-۰۴.xlsx')).toEqual({ y: 1405, m: 8, d: 4 });
  });
  it('returns null when absent or invalid', () => {
    expect(snapshotDateFromFileName('data.xlsx')).toBeNull();
    expect(snapshotDateFromFileName('x-1405-13-40.xlsx')).toBeNull();
  });
});
