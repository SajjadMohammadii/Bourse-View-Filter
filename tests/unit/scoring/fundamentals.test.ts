import { describe, it, expect } from 'vitest';
import { loadSample, sampleRows, SAMPLE_NAME } from '../../helpers/sample';
import { processRows } from '../../../src/app/pipeline';
import { profiles } from '../../../src/config/profiles';
import { FINANCIAL_INDUSTRIES } from '../../../src/config/industryOverrides';
import { quarterlyFlags, monthlyFlags } from '../../../src/config/flags';
import { computeFlags } from '../../../src/core/scoring/flags';
import { defaultAssumptions, thresholds } from '../../../src/config/assumptions';
import { miniDataset } from '../../helpers/mini';

describe('phase 4 acceptance on the sample file', () => {
  const { dataset: ds } = loadSample();
  const n = (id: string, i: number) => ds.num[id]?.[i] ?? NaN;

  it('registers 4 profiles with 7/8/7/6 factors', () => {
    expect(profiles.map((p) => [p.id, p.factors.length])).toEqual([
      ['technical', 7],
      ['fundamentalLong', 8],
      ['fundamentalQuarterly', 7],
      ['fundamentalMonthly', 6],
    ]);
  });

  it('symbols without Rev_1M are "no monthly report" (ineligible, no score)', () => {
    const rev = ds.num['Rev_1M']!;
    let missing = 0;
    for (let i = 0; i < ds.size; i++) {
      if (!Number.isNaN(rev[i]!)) continue;
      missing++;
      expect(n('eligible.fundamentalMonthly', i)).toBe(0);
      expect(n('score.fundamentalMonthly', i)).toBeNaN();
      expect(n('score.mTransform', i)).toBeNaN();
    }
    expect(missing).toBeGreaterThan(200);
  });

  it('financials skip the efficiency factor; banks are scored without leverage metrics', () => {
    const ind = ds.text['Industry']!;
    const fin = [...ds.symbols.keys()].filter((i) => FINANCIAL_INDUSTRIES.includes(ind[i]!));
    expect(fin.every((i) => Number.isNaN(n('factor.fundamentalLong.L6', i)))).toBe(true);
    const banks = fin.filter((i) => ind[i] === 'بانکها و موسسات اعتباری');
    const scored = banks.filter((i) => Number.isFinite(n('score.fundamentalLong', i)));
    expect(scored.length).toBeGreaterThanOrEqual(10);
    expect(scored.every((i) => Number.isNaN(n('factor.fundamentalLong.L4', i)))).toBe(true);
  });

  it('investment companies use PtoNAV in valuation', () => {
    const ind = ds.text['Industry']!;
    const inv = [...ds.symbols.keys()].filter(
      (i) => ind[i] === 'سرمایه گذاری' && Number.isFinite(n('PtoNAV', i)),
    );
    expect(inv.length).toBeGreaterThan(10);
    expect(inv.filter((i) => Number.isFinite(n('factor.fundamentalLong.L7', i))).length).toBe(inv.length);
  });

  it('computes Piotroski-lite, transformation indices and the composite', () => {
    const pio = [...ds.num['D_PiotroskiLite']!].filter(Number.isFinite);
    expect(Math.min(...pio)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...pio)).toBeLessThanOrEqual(7);
    for (const id of ['score.qTransform', 'score.mTransform', 'score.composite']) {
      expect([...ds.num[id]!].filter(Number.isFinite).length).toBeGreaterThan(600);
    }
  });

  it('seasonality mode changes monthly scores only in Farvardin/Ordibehesht snapshots', () => {
    const run = (fileName: string, seasonality: boolean) => {
      const r = processRows(sampleRows(), {
        fileName,
        scoring: { peerMode: 'default', stalePenalty: false, seasonality },
      });
      if (!r.ok) throw new Error(r.error.message);
      return r.value.dataset.num['score.fundamentalMonthly']!;
    };
    const farvardinOn = run('screener-plus-1405-01-20.xlsx', true);
    const farvardinOff = run('screener-plus-1405-01-20.xlsx', false);
    expect([...farvardinOn]).not.toEqual([...farvardinOff]);
    expect([...run(SAMPLE_NAME, true)]).toEqual([...run(SAMPLE_NAME, false)]);
  });

  it('stale-statement penalty lowers fundamental scores of old statements', () => {
    const on = processRows(sampleRows(), {
      fileName: SAMPLE_NAME,
      scoring: { peerMode: 'default', stalePenalty: true },
    });
    if (!on.ok) throw new Error(on.error.message);
    const age = ds.num['D_StatementAgeDays']!;
    const i = [...ds.symbols.keys()].find(
      (k) => age[k]! > 200 && Number.isFinite(n('score.fundamentalLong', k)),
    );
    expect(i).toBeDefined();
    expect(on.value.dataset.num['score.fundamentalLong']![i!]).toBeCloseTo(
      n('score.fundamentalLong', i!) * 0.9,
    );
    expect(on.value.dataset.num['score.technical']![i!]).toBe(n('score.technical', i!));
  });
});

describe('quarterly and monthly flags', () => {
  const ctx = { assumptions: defaultAssumptions, snapshotDate: null, thresholds };
  const flags = (row: Record<string, number | null>) => {
    const out = computeFlags(miniDataset([row]), [...quarterlyFlags, ...monthlyFlags], ctx);
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v[0]]));
  };
  it('turnaroundQ: positive quarter after a losing year / losing previous quarter', () => {
    expect(flags({ NI_MRQ: 10, NI_FY: -5 }).turnaroundQ).toBe(1);
    expect(flags({ NI_MRQ: 10, NI_FY: 50, D_NI_PrevQ_est: -2, NIQtrlyGR_QoQ: 1 }).turnaroundQ).toBe(1);
    expect(flags({ NI_MRQ: 10, NI_FY: 50, NIQtrlyGR_QoQ: null, NI_TTM: 5 }).turnaroundQ).toBe(1);
    expect(flags({ NI_MRQ: -1, NI_FY: -5 }).turnaroundQ).toBe(0);
    expect(
      flags({ NI_MRQ: 10, NI_FY: 50, D_NI_PrevQ_est: 8, NIQtrlyGR_QoQ: 0.2, NI_TTM: 40 }).turnaroundQ,
    ).toBe(0);
  });
  it('margin breakout / surprise / stale / one-off', () => {
    expect(flags({ D_dNPMargin_Q: 0.06, NIQtrlyGR_YoY: 0.5 }).marginBreakout).toBe(1);
    expect(flags({ D_dNPMargin_Q: 0.06, NIQtrlyGR_YoY: 0.2 }).marginBreakout).toBe(0);
    expect(flags({ D_NI_RunRate: 1.6 }).earningsSurprise).toBe(1);
    expect(flags({ D_StatementAgeDays: 250 }).staleStatement).toBe(1);
    expect(flags({ D_NonOpShare_Q: 0.6 }).oneOffRisk).toBe(1);
    expect(flags({}).oneOffRisk).toBeNaN();
  });
  it('monthly flags', () => {
    expect(flags({ D_Rev1M_toAvg12_real: 1.4, D_Rev1M_toQAvg: 1.2 }).recordMonth).toBe(1);
    expect(flags({ Rev_1MGR: 0.3, Rev_3MGR: -0.1 }).monthlyTurn).toBe(1);
    expect(flags({ D_ImpliedPE_M: 4, D_ImpliedNI_M: 10 }).cheapOnMonthly).toBe(1);
    expect(flags({ D_ImpliedPE_M: -Infinity, D_ImpliedNI_M: -10 }).cheapOnMonthly).toBe(0);
  });
});
