import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../../../src/core/metrics/registry';
import { derivedMetrics } from '../../../src/config/derivedMetrics';
import { defaultAssumptions } from '../../../src/config/assumptions';
import { miniDataset } from '../../helpers/mini';

type Row = Record<string, number | null>;
type Expected = number | null | 'NB';
interface Case {
  row: Row;
  expected: Expected;
  note?: string;
}

const NB = 'NB' as const;
const debt = { DebtRatio: 0.1, TA_MRQ: 1000 }; // D_Debt = 100

/** metric id → [manual case, edge case, …] */
const cases: Record<string, Case[]> = {
  D_Debt: [
    { row: debt, expected: 100 },
    { row: { DebtRatio: null, TA_MRQ: 1000 }, expected: null },
  ],
  D_DebtToRev: [
    { row: { ...debt, Rev_TTM: 400 }, expected: 0.25 },
    { row: { ...debt, Rev_TTM: 0 }, expected: null },
  ],
  D_TLToRev: [
    { row: { TL_MRQ: 600, Rev_TTM: 300 }, expected: 2 },
    { row: { TL_MRQ: 600, Rev_TTM: null }, expected: null },
  ],
  D_DebtToMcap: [
    { row: { ...debt, MarketCap: 500 }, expected: 0.2 },
    { row: { ...debt, MarketCap: 0 }, expected: null },
  ],
  D_EV: [
    { row: { ...debt, MarketCap: 500 }, expected: 600 },
    { row: { ...debt, MarketCap: null }, expected: null },
  ],
  D_DebtToOP: [
    { row: { ...debt, OP_TTM: 50 }, expected: 2 },
    { row: { ...debt, OP_TTM: -5 }, expected: NB },
    { row: { DebtRatio: 0, TA_MRQ: 1000, OP_TTM: -5 }, expected: 0, note: 'no debt' },
  ],
  D_FEtoOP: [
    { row: { FE_TTM: 10, OP_TTM: 40 }, expected: 0.25 },
    { row: { FE_TTM: 10, OP_TTM: 0 }, expected: NB },
  ],
  D_FEtoRev: [
    { row: { FE_TTM: 10, Rev_TTM: 200 }, expected: 0.05 },
    { row: { FE_TTM: 10, Rev_TTM: 0 }, expected: null },
  ],
  D_EquityToAsset: [
    { row: { TSE_MRQ: 400, TA_MRQ: 1000 }, expected: 0.4 },
    { row: { TSE_MRQ: 400, TA_MRQ: 0 }, expected: null },
  ],
  D_ROIC: [
    { row: { EBIT: 100, ETR: 0.2, TSE_MRQ: 300, ...debt }, expected: 0.2 },
    { row: { OP_TTM: 100, ETR: 0, TSE_MRQ: 400, TA_MRQ: 1000 }, expected: 0.25, note: 'EBIT fallback' },
    { row: { OP_TTM: 100, TSE_MRQ: -500, ...debt }, expected: NB },
  ],
  D_AltmanZ_approx: [
    {
      row: { EBIT: 100, TA_MRQ: 1000, MarketCap: 600, TL_MRQ: 300, Rev_TTM: 500, RE_MRQ: 200 },
      expected: 2.31,
    },
    { row: { EBIT: 100, TA_MRQ: 0, MarketCap: 600, TL_MRQ: 300, Rev_TTM: 500, RE_MRQ: 200 }, expected: null },
  ],
  D_CCC_approx: [
    { row: { InvTurnoverDay: 100, ReceivableTurnoverDay: 50 }, expected: 150 },
    { row: { InvTurnoverDay: 100, ReceivableTurnoverDay: null }, expected: null },
  ],
  D_CFO: [
    { row: { CFOToRev: 0.1, Rev_TTM: 1000 }, expected: 100 },
    { row: { CFOToRev: null, Rev_TTM: 1000 }, expected: null },
  ],
  D_CFOtoNI: [
    { row: { CFOToRev: 0.1, Rev_TTM: 1000, NI_TTM: 80 }, expected: 1.25 },
    { row: { CFOToRev: 0.1, Rev_TTM: 1000, NI_TTM: -10 }, expected: null },
  ],
  D_Accruals: [
    { row: { NI_TTM: 80, CFOToRev: 0.1, Rev_TTM: 1000, TA_MRQ: 400 }, expected: -0.05 },
    { row: { NI_TTM: 80, CFOToRev: 0.1, Rev_TTM: 1000, TA_MRQ: 0 }, expected: null },
  ],
  D_FCFF: [
    { row: { FCFFToRev: 0.05, Rev_TTM: 1000 }, expected: 50 },
    { row: { FCFFToRev: 0.05 }, expected: null },
  ],
  D_FCFFYield: [
    { row: { FCFFToRev: 0.05, Rev_TTM: 1000, MarketCap: 500 }, expected: 0.1 },
    { row: { FCFFToRev: 0.05, Rev_TTM: 1000, MarketCap: 0 }, expected: null },
  ],
  D_FxShareNI: [
    { row: { NetFx_IRR: 20, NI_TTM: -80 }, expected: 0.25 },
    { row: { NetFx_IRR: 20, NI_TTM: 0 }, expected: null },
  ],
  D_EarningsYield: [
    { row: { NI_TTM: 50, MarketCap: 500 }, expected: 0.1 },
    { row: { NI_TTM: 50, MarketCap: 0 }, expected: null },
  ],
  D_EYSpread: [
    { row: { NI_TTM: 50, MarketCap: 500 }, expected: 0.1 - 0.3 },
    { row: { MarketCap: 500 }, expected: null },
  ],
  D_PE_ttm: [
    { row: { MarketCap: 1000, NI_TTM: 100 }, expected: 10 },
    { row: { MarketCap: 1000, NI_TTM: -5 }, expected: NB },
  ],
  D_PEG_approx: [
    { row: { PtoE_ttm: 5, NI_3YrGR: 0.62, NI_TTM: 10 }, expected: 0.25 },
    { row: { PtoE_ttm: 5, NI_3YrGR: 0.2, NI_TTM: 10 }, expected: NB, note: 'real growth ≤ 0' },
    { row: { NI_3YrGR: 0.62, NI_TTM: -5 }, expected: NB, note: 'loss' },
  ],
  D_OPYieldEV: [
    { row: { OP_TTM: 60, MarketCap: 500, ...debt }, expected: 0.1 },
    { row: { OP_TTM: 60 }, expected: null },
  ],
  D_dTL: [
    { row: { TL_MRQ: 120, TL_FY: 100 }, expected: 0.2 },
    { row: { TL_MRQ: 120, TL_FY: 0 }, expected: null },
  ],
  D_dTA: [
    { row: { TA_MRQ: 110, TA_FY: 100 }, expected: 0.1 },
    { row: { TA_MRQ: 110 }, expected: null },
  ],
  D_dEquity: [
    { row: { TSE_MRQ: 50, TSE_FY: -100 }, expected: 1.5 },
    { row: { TSE_MRQ: 50, TSE_FY: null }, expected: null },
  ],
  D_dLevGap: [
    { row: { TL_MRQ: 60, TA_MRQ: 100, TL_FY: 50, TA_FY: 100 }, expected: 0.1 },
    { row: { TL_MRQ: 60, TA_MRQ: 100, TL_FY: 50, TA_FY: 0 }, expected: null },
  ],
  D_dRE: [
    { row: { RE_MRQ: 30, RE_FY: 10, TA_MRQ: 200 }, expected: 0.1 },
    { row: { RE_MRQ: 30, TA_MRQ: 200 }, expected: null },
  ],
  D_NI_MRQ_toTTM: [
    { row: { NI_MRQ: 30, NI_TTM: 100 }, expected: 0.3 },
    { row: { NI_MRQ: 30, NI_TTM: -100 }, expected: 0.3, note: 'negative base keeps sign of quarter' },
  ],
  D_NI_MRQ_toFY: [
    { row: { NI_MRQ: 40, NI_FY: 100 }, expected: 0.4 },
    { row: { NI_MRQ: 40, NI_FY: 0 }, expected: null },
  ],
  D_NI_RunRate: [
    { row: { NI_MRQ: 30, NI_TTM: 100 }, expected: 1.2 },
    { row: { NI_MRQ: -30, NI_TTM: 100 }, expected: -1.2 },
  ],
  D_Rev_RunRateQ: [
    { row: { Rev_MRQ: 300, Rev_TTM: 1000 }, expected: 1.2 },
    { row: { Rev_MRQ: 300, Rev_TTM: 0 }, expected: null },
  ],
  D_FwdEY_Q: [
    { row: { NI_MRQ: 25, MarketCap: 1000 }, expected: 0.1 },
    { row: { NI_MRQ: 25, MarketCap: null }, expected: null },
  ],
  D_FwdPE_Q: [
    { row: { MarketCap: 1000, NI_MRQ: 25 }, expected: 10 },
    { row: { MarketCap: 1000, NI_MRQ: -1 }, expected: NB },
  ],
  D_RevYield_Q: [
    { row: { Rev_MRQ: 250, MarketCap: 1000 }, expected: 1 },
    { row: { Rev_MRQ: 250, MarketCap: 0 }, expected: null },
  ],
  D_OPYield_Q: [
    { row: { OP_MRQ: 15, MarketCap: 500, ...debt }, expected: 0.1 },
    { row: { OP_MRQ: 15 }, expected: null },
  ],
  D_dNPMargin_Q: [
    { row: { NPMarginMRQ: 0.2, NPMargin: 0.15 }, expected: 0.05 },
    { row: { NPMarginMRQ: 0.2 }, expected: null },
  ],
  D_dGPMargin_Q: [
    { row: { GPMarginMRQ: 0.1, GPMargin: 0.3 }, expected: -0.2 },
    { row: { GPMargin: 0.3 }, expected: null },
  ],
  D_dOPMargin_Q: [
    { row: { OPMarginMRQ: 0.25, OPMargin: 0.2 }, expected: 0.05 },
    { row: { OPMarginMRQ: null }, expected: null },
  ],
  D_DebtToRev_Q: [
    { row: { ...debt, Rev_MRQ: 50 }, expected: 0.5 },
    { row: { ...debt, Rev_MRQ: 0 }, expected: null },
  ],
  D_FEtoOP_Q: [
    { row: { FE_MRQ: 5, OP_MRQ: 20 }, expected: 0.25 },
    { row: { FE_MRQ: 5, OP_MRQ: -1 }, expected: NB },
  ],
  D_NonOpShare_Q: [
    { row: { NI_MRQ: 100, OP_MRQ: 100, FE_MRQ: 20, ETR: 0.2 }, expected: 0.36 },
    { row: { NI_MRQ: 0, OP_MRQ: 100, FE_MRQ: 20, ETR: 0.2 }, expected: null },
  ],
  D_NI_PrevQ_est: [
    { row: { NI_MRQ: 120, NIQtrlyGR_QoQ: 0.2 }, expected: 100 },
    { row: { NI_MRQ: 120, NIQtrlyGR_QoQ: -1 }, expected: null },
  ],
  D_StatementAgeDays: [
    { row: { LastStatementDate: 14050631 }, expected: 34 },
    { row: { LastStatementDate: 0 }, expected: null },
  ],
  D_FxShareNI_Q: [
    { row: { NetFx_IRR: -10, NI_MRQ: 40 }, expected: -0.25 },
    { row: { NetFx_IRR: -10, NI_MRQ: 0 }, expected: null },
  ],
  D_Rev1M_toAvg12: [
    { row: { Rev_1M: 120, Rev_TTM: 1200 }, expected: 1.2 },
    { row: { Rev_1M: 120, Rev_TTM: 0 }, expected: null },
  ],
  D_Rev1M_toAvg12_real: [
    { row: { Rev_1M: 120, Rev_TTM: 1200 }, expected: 1.2 / Math.pow(1.35, 6.5 / 12) },
    { row: { Rev_1M: null, Rev_TTM: 1200 }, expected: null },
  ],
  D_Rev1M_toQAvg: [
    { row: { Rev_1M: 120, Rev_MRQ: 300 }, expected: 1.2 },
    { row: { Rev_1M: 120, Rev_MRQ: 0 }, expected: null },
  ],
  D_Rev1M_toFYAvg: [
    { row: { Rev_1M: 120, Rev_FY: 1200 }, expected: 1.2 },
    { row: { Rev_1M: 120 }, expected: null },
  ],
  D_Rev1M_toNI_FY: [
    { row: { Rev_1M: 50, NI_FY: 100 }, expected: 0.5 },
    { row: { Rev_1M: 50, NI_FY: -1 }, expected: null },
  ],
  D_RevYield_M: [
    { row: { Rev_1M: 10, MarketCap: 240 }, expected: 0.5 },
    { row: { Rev_1M: 10, MarketCap: 0 }, expected: null },
  ],
  D_ImpliedNI_M: [
    { row: { Rev_1M: 100, NPMarginMRQ: 0.1, NPMargin: 0.2 }, expected: 120 },
    { row: { Rev_1M: 100, NPMarginMRQ: null, NPMargin: 0.2 }, expected: 240, note: 'margin fallback' },
  ],
  D_ImpliedPE_M: [
    { row: { MarketCap: 1200, Rev_1M: 100, NPMarginMRQ: 0.1 }, expected: 10 },
    { row: { MarketCap: 1200, Rev_1M: 100, NPMarginMRQ: -0.1 }, expected: NB },
  ],
  D_ImpliedEarnGrowth_M: [
    { row: { Rev_1M: 100, NPMarginMRQ: 0.1, NI_FY: 100 }, expected: 0.2 },
    { row: { Rev_1M: 100, NPMarginMRQ: 0.1, NI_FY: 0 }, expected: null },
  ],
  D_RevAccel_M: [
    { row: { Rev_1MGR: 0.3, Rev_3MGR: 0.1 }, expected: 0.2 },
    { row: { Rev_1MGR: 0.3 }, expected: null },
  ],
  D_RevConsistency_M: [
    { row: { Rev_3MGR_Arith: 0.3, Rev_3MGR: 0.2 }, expected: 0.8 },
    { row: { Rev_3MGR_Arith: null, Rev_3MGR: 0.2 }, expected: null },
  ],
  D_PxToSMA20: [
    { row: { Price: 110, SMA_20D: 100 }, expected: 0.1 },
    { row: { Price: 110, SMA_20D: 0 }, expected: null },
  ],
  D_PxToSMA50: [
    { row: { Price: 90, SMA_50D: 100 }, expected: -0.1 },
    { row: { Price: null, SMA_50D: 100 }, expected: null },
  ],
  D_PxToSMA200: [
    { row: { Price: 150, SMA_200D: 100 }, expected: 0.5 },
    { row: { Price: 150 }, expected: null },
  ],
  D_MAAlignment: [
    {
      row: { Price: 110, SMA_20D: 100, SMA_50D: 90, SMA_200D: 95, EMA_50D: 100, EMA_200D: 90, sar: 120 },
      expected: 0.6,
    },
    { row: { Price: null }, expected: null },
  ],
  D_DirectionalADX: [
    { row: { plus_di: 30, minus_di: 10, adx: 50 }, expected: 0.5 },
    { row: { plus_di: 10, minus_di: 30, adx: 12.5 }, expected: -0.25 },
    { row: { plus_di: 0, minus_di: 0, adx: 20 }, expected: null },
  ],
  D_RegSlopeNorm: [
    { row: { linearreg_slope: -7.8, Price: 554 }, expected: -7.8 / 554 },
    { row: { Price: 554 }, expected: null },
  ],
  D_MACDHistNorm: [
    { row: { macdHistogram: 5, Price: 100 }, expected: 0.05 },
    { row: { macdHistogram: 5, Price: 0 }, expected: null },
  ],
  D_BollingerPctB: [
    { row: { Price: 105, blbands: 100, bubands: 120 }, expected: 0.25 },
    { row: { Price: 105, blbands: 100, bubands: 100 }, expected: null },
  ],
  D_PivotPos: [
    { row: { Price: 110, pp_standard_s1: 100, pp_standard_r1: 140 }, expected: 0.25 },
    { row: { Price: 110, pp_standard_s1: 100, pp_standard_r1: 100 }, expected: null },
  ],
  D_PxToVWAP1M: [
    { row: { Price: 110, AvgVWAP_1M: 100 }, expected: 0.1 },
    { row: { Price: 110 }, expected: null },
  ],
  D_VolSurge_5_90: [
    { row: { AvgVol_5D: 200, AvgVol_90D: 100 }, expected: 2 },
    { row: { AvgVol_5D: 200, AvgVol_90D: 0 }, expected: null },
  ],
  D_VolSurge_20_1Y: [
    { row: { AvgVol_20D: 150, AvgVol_1Yr: 100 }, expected: 1.5 },
    { row: { AvgVol_20D: 150 }, expected: null },
  ],
  D_VolToday_30: [
    { row: { CurrentVolume: 50, AvgVol_30D: 100 }, expected: 0.5 },
    { row: { CurrentVolume: 50, AvgVol_30D: 0 }, expected: null },
  ],
  D_LogLiquidity: [
    { row: { AvgVal_20D: 1e12 }, expected: 12 },
    { row: { AvgVal_20D: 0 }, expected: null },
  ],
  D_NetIndToVal: [
    { row: { NetIndividualValue: 50, AvgVal_20D: 200 }, expected: 0.25 },
    { row: { NetIndividualValue: 50 }, expected: null },
  ],
  D_ADOscNorm: [
    { row: { adosc: -100, AvgVol_20D: 1000 }, expected: -0.1 },
    { row: { adosc: -100, AvgVol_20D: 0 }, expected: null },
  ],
  D_DownsideRatio: [
    { row: { SemiStdDev_90D: 0.02, StdDev_90D: 0.04 }, expected: 0.5 },
    { row: { SemiStdDev_90D: 0.02, StdDev_90D: 0 }, expected: null },
  ],
  D_BetaDeviation: [
    { row: { Beta_60W: 0.6 }, expected: 0.4 },
    { row: { Beta_60W: null }, expected: null },
  ],
  D_GrowthConsistency_5y: [
    { row: { Rev_5yrGR_Arith: 0.3, Rev_5YrGR: 0.2 }, expected: 0.8 },
    { row: { Rev_5yrGR_Arith: 0.3 }, expected: null },
  ],
  D_PiotroskiLite: [
    {
      row: {
        ROA: 0.1,
        CFOToRev: 0.2,
        Rev_TTM: 1000,
        NI_TTM: 100,
        TA_MRQ: 1000,
        NI_FY: 50,
        TA_FY: 1000,
        TL_MRQ: 400,
        TL_FY: 500,
        GPMargin: 0.3,
        GP_FY: 200,
        Rev_FY: 800,
      },
      expected: 7,
    },
    {
      row: {
        ROA: -0.1,
        CFOToRev: -0.1,
        Rev_TTM: 1000,
        NI_TTM: 10,
        TA_MRQ: 1000,
        TL_MRQ: 600,
        TL_FY: 500,
        TA_FY: 1000,
      },
      expected: 0,
    },
    { row: { ROA: 0.1 }, expected: null, note: 'too few tests' },
  ],
  D_FiscalYearEndMonth: [
    { row: { FiscalYear: 1229 }, expected: 12 },
    { row: { FiscalYear: 930 }, expected: 9 },
  ],
};

function run(row: Row, metric: string): number {
  const ds = miniDataset([row]);
  const r = computeMetrics(ds, derivedMetrics, {
    assumptions: defaultAssumptions,
    snapshotDate: ds.snapshotDate,
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.dataset.num[metric]?.[0] ?? NaN;
}

describe('derived metrics (PLAN.md §5.2)', () => {
  it('every system metric has at least one manual and one edge case', () => {
    const missing = derivedMetrics.filter((m) => (cases[m.id]?.length ?? 0) < 2).map((m) => m.id);
    expect(missing).toEqual([]);
  });

  for (const [metric, list] of Object.entries(cases)) {
    list.forEach(({ row, expected, note }, k) => {
      it(`${metric} #${k + 1}${note ? ` (${note})` : ''}`, () => {
        const v = run(row, metric);
        if (expected === null) expect(Number.isNaN(v)).toBe(true);
        else if (expected === NB) expect(v).toBe(-Infinity);
        else expect(v).toBeCloseTo(expected, 9);
      });
    });
  }

  it('does not mutate the input dataset', () => {
    const ds = miniDataset([{ DebtRatio: 0.1, TA_MRQ: 1000 }]);
    const before = Object.keys(ds.num).length;
    computeMetrics(ds, derivedMetrics, { assumptions: defaultAssumptions, snapshotDate: null });
    expect(Object.keys(ds.num)).toHaveLength(before);
  });

  it('all metric ids use the D_ prefix and descriptions are present', () => {
    for (const m of derivedMetrics) {
      expect(m.id.startsWith('D_')).toBe(true);
      expect(m.description.length).toBeGreaterThan(3);
    }
  });
});
