import { describe, it, expect } from 'vitest';
import { loadSample, idx } from '../../helpers/sample';

describe('phase 2 acceptance on the sample file (ذوب)', () => {
  const { dataset: ds, metrics } = loadSample();
  const i = idx(ds.symbols, 'ذوب');
  const v = (id: string) => ds.num[id]?.[i] ?? NaN;

  it('D_Debt ≈ 1.464e14', () => {
    expect(v('D_Debt') / 1.464e14).toBeCloseTo(1, 2);
  });
  it('D_DebtToRev ≈ 0.213', () => {
    expect(v('D_DebtToRev')).toBeCloseTo(0.213, 3);
  });
  it('reconstructed LiabilityToAsset ≈ 0.6545', () => {
    expect(v('TL_MRQ') / v('TA_MRQ')).toBeCloseTo(0.6545, 4);
    expect(v('LiabilityToAsset')).toBeCloseTo(0.6545, 4);
  });
  it('confirmed identities hold across the market (median ratio ≈ 1)', () => {
    const ratios: number[] = [];
    for (let k = 0; k < ds.size; k++) {
      const pe = ds.num['PtoE_ttm']?.[k] ?? NaN;
      const derived = (ds.num['MarketCap']?.[k] ?? NaN) / (ds.num['NI_TTM']?.[k] ?? NaN);
      if (Number.isFinite(pe) && Number.isFinite(derived) && derived > 0) ratios.push(pe / derived);
    }
    ratios.sort((a, b) => a - b);
    expect(ratios[Math.floor(ratios.length / 2)]).toBeCloseTo(1, 2);
  });
  it('statement age for ذوب is 34 days and no metric input is missing', () => {
    expect(v('D_StatementAgeDays')).toBe(34);
    expect(metrics.missingInputs).toEqual({});
  });
  it('produces no NaN-only metric columns', () => {
    const empty = metrics.computed.filter((id) => [...(ds.num[id] ?? [])].every((x) => Number.isNaN(x)));
    expect(empty).toEqual([]);
  });
});
