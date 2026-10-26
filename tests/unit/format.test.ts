import { describe, it, expect } from 'vitest';
import { formatByUnit, formatMoney, formatPercent, formatNumber } from '../../src/core/utils/format';

const latin = { moneyUnit: 'hemat' as const, digits: 'latin' as const };

describe('format', () => {
  it('formats money in hemat and billion toman', () => {
    expect(formatMoney(370899018602036, latin)).toBe('37.09 همت');
    expect(formatMoney(370899018602036, { ...latin, moneyUnit: 'billionToman' })).toBe(
      '37,089.9 میلیارد تومان',
    );
  });
  it('formats percents with Persian digits by default', () => {
    expect(formatPercent(0.1305)).toBe('۱۳٫۰۵٪');
  });
  it('shows a dash for null and a label for negative base', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(-Infinity)).toBe('پایه منفی');
  });
  it('formats by unit', () => {
    expect(formatByUnit(120.58, 'days', latin)).toBe('121 روز');
    expect(formatByUnit(14050631, 'date', latin)).toBe('1405/06/31');
  });
});
