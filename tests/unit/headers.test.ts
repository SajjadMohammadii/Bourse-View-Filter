import { describe, it, expect } from 'vitest';
import { normalizeHeader, planHeaders } from '../../src/core/data/normalizeHeaders';

describe('normalizeHeader', () => {
  it('removes newlines and trims', () => {
    expect(normalizeHeader('OP_Margin_TTM_3yGR\n_Arith')).toBe('OP_Margin_TTM_3yGR_Arith');
    expect(normalizeHeader('GP_Margin_TTM_1yGR\n')).toBe('GP_Margin_TTM_1yGR');
    expect(normalizeHeader('  Price  ')).toBe('Price');
    expect(normalizeHeader(null)).toBe('');
  });
});

describe('planHeaders', () => {
  it('drops unnamed empty columns and keeps unnamed filled ones', () => {
    const plan = planHeaders(['', 'Symbol', 'Unnamed: 2'], (i) => i === 0);
    expect(plan.dropped).toEqual(['#1']);
    expect(plan.columns.map((c) => c.id)).toEqual(['Symbol', 'col_3']);
  });
  it('suffixes duplicates', () => {
    const plan = planHeaders(['A', 'A\n', 'A'], () => false);
    expect(plan.columns.map((c) => c.id)).toEqual(['A', 'A__2', 'A__3']);
  });
  it('records renamed headers', () => {
    const plan = planHeaders(['NI_TTM', 'X\n'], () => false);
    expect(plan.renamed).toEqual([{ from: 'X\n', to: 'X' }]);
  });
});
