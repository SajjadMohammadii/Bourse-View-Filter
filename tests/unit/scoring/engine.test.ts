import { describe, it, expect } from 'vitest';
import { scoreAll, validateProfile, compositeScore } from '../../../src/core/scoring/scoreAll';
import type { ProfileDef, IndustryOverride, ScoringOptions } from '../../../src/core/scoring/types';
import { scoringConfig } from '../../../src/config/scoring';
import { defaultAssumptions, thresholds } from '../../../src/config/assumptions';
import { profiles } from '../../../src/config/profiles';
import { up, down, linear } from '../../../src/config/profiles/builders';
import { miniDataset } from '../../helpers/mini';

const factor = (id: string, weight: number, metrics = [up('a')]) => ({
  id,
  label: id,
  weight,
  description: '',
  metrics,
});

const toy: ProfileDef = {
  id: 'toy',
  label: 'آزمایشی',
  description: '',
  defaultPeerScope: 'market',
  minCoverage: 0.6,
  factors: [
    factor('F1', 1, [up('a'), down('b')]),
    factor('F2', 1, [linear('c', 0, 1)]),
    factor('F3', 1, [up('a')]),
    factor('F4', 1, [up('d')]),
  ],
  weightPresets: {},
};

function score(
  rows: Array<Record<string, number | string | null>>,
  p = toy,
  overrides: IndustryOverride[] = [],
  options: Partial<ScoringOptions> = {},
) {
  const r = scoreAll(miniDataset(rows), {
    profiles: [p],
    overrides,
    flags: [],
    config: scoringConfig,
    options: { peerMode: 'default', stalePenalty: false, ...options },
    flagContext: { assumptions: defaultAssumptions, snapshotDate: null, thresholds },
    stale: { days: 200, penalty: 0.9 },
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value.dataset;
}

describe('factor engine', () => {
  it('combines percentile directions and redistributes missing metric weight', () => {
    const ds = score([
      { a: 1, b: 3, c: 0, d: 1 },
      { a: 2, b: 2, c: 0.5, d: 2 },
      { a: 3, b: null, c: 1, d: 3 },
    ]);
    const f1 = ds.num['factor.toy.F1']!;
    expect(f1[0]).toBe(0); // a pct 0, b (lower) pct 0
    expect(f1[1]).toBe(75); // a 50, b (lower) 100
    expect(f1[2]).toBe(100); // b missing → only a
    expect([...ds.num['factor.toy.F2']!]).toEqual([0, 50, 100]);
  });

  it('nulls a factor below minCoverage and the profile below its minCoverage', () => {
    const ds = score([
      { a: 1, b: null, c: null, d: null },
      { a: 2, b: 1, c: 1, d: 1 },
    ]);
    expect(ds.num['factor.toy.F1']![0]).toBe(0); // 50% coverage = default minimum
    expect(ds.num['factor.toy.F2']![0]).toBeNaN();
    expect(ds.num['score.toy']![0]).toBeNaN(); // F1 + F3 = 50% < 60%
    expect(ds.num['conf.toy']![0]).toBeCloseTo((0.5 + 0 + 1 + 0) / 4);
    expect(Number.isFinite(ds.num['score.toy']![1]!)).toBe(true);
    expect(ds.num['conf.toy']![1]).toBe(1);
  });

  it('applies industry overrides: disabled metric, extra metric, multiplier, disabled factor', () => {
    const rows = [
      { Industry: 'بانک', a: 1, b: 1, c: 0, d: 1, x: 10 },
      { Industry: 'بانک', a: 2, b: 2, c: 0, d: 2, x: 0 },
      { Industry: 'سایر', a: 3, b: 3, c: 0, d: 3, x: 5 },
    ];
    const ov: IndustryOverride = {
      id: 'bank',
      label: 'بانک',
      industries: ['بانک'],
      disableMetrics: ['b'],
      extraMetrics: { F1: [up('x')] },
      disableFactors: ['F2'],
      weightMultipliers: { x: 3 },
    };
    const ds = score(rows, toy, [ov]);
    const f1 = ds.num['factor.toy.F1']!;
    // bank row 0: a pct 0 (w1), x pct 100 (w3) → 75 ; other row ignores x
    expect(f1[0]).toBeCloseTo(75);
    expect(f1[2]).toBeCloseTo((100 + 0) / 2);
    expect(ds.num['factor.toy.F2']![0]).toBeNaN(); // disabled for this industry
    const plain = score(rows);
    expect(ds.num['score.toy']![0]).not.toBe(plain.num['score.toy']![0]);
  });

  it('honors eligibility and custom factor weights', () => {
    const p: ProfileDef = { ...toy, eligibility: (r) => r.get('d') !== null };
    const ds = score(
      [
        { a: 1, d: null },
        { a: 2, b: 1, c: 1, d: 1 },
      ],
      p,
    );
    expect(ds.num['score.toy']![0]).toBeNaN();
    expect(ds.num['eligible.toy']![0]).toBe(0);
    const w = score(
      [
        { a: 1, b: 1, c: 1, d: 1 },
        { a: 2, b: 2, c: 0, d: 2 },
      ],
      toy,
      [],
      {
        factorWeights: { toy: { F2: 0, F3: 0, F4: 0 } },
      },
    );
    expect(w.num['score.toy']![1]).toBe(w.num['factor.toy.F1']![1]);
  });

  it('writes ranks, industry ranks and grades', () => {
    const ds = score([
      { Industry: 'الف', a: 1, b: 3, c: 0, d: 1 },
      { Industry: 'الف', a: 3, b: 1, c: 1, d: 3 },
      { Industry: 'ب', a: 2, b: 2, c: 0.5, d: 2 },
    ]);
    expect([...ds.num['rank.toy']!]).toEqual([3, 1, 2]);
    expect([...ds.num['rankInIndustry.toy']!]).toEqual([2, 1, 1]);
    expect(ds.text['grade.toy']).toEqual(['E', 'A', 'C']);
  });
});

describe('composite', () => {
  it('redistributes the weight of missing profiles (PLAN.md §6.8)', () => {
    const mk = (id: string, xs: number[]) => ({
      id,
      score: Float64Array.from(xs),
      conf: new Float64Array(),
      eligible: new Uint8Array(),
      factors: {},
      derived: {},
    });
    const c = compositeScore([mk('a', [80, 80]), mk('b', [40, NaN])], { a: 0.75, b: 0.25 }, 2);
    expect(c[0]).toBe(70);
    expect(c[1]).toBe(80);
  });
});

describe('profile configs', () => {
  it('every registered profile has 4..8 factors and valid weights', () => {
    for (const p of profiles) expect(validateProfile(p)).toEqual([]);
  });
  it('rejects a profile with too few factors', () => {
    expect(validateProfile({ ...toy, factors: toy.factors.slice(0, 3) })).toHaveLength(1);
  });
  it('weight presets reference real factors and sum to 100', () => {
    for (const p of profiles) {
      const ids = new Set(p.factors.map((f) => f.id));
      for (const preset of Object.values(p.weightPresets)) {
        expect(Object.keys(preset.weights).every((k) => ids.has(k))).toBe(true);
        expect(Object.values(preset.weights).reduce((a, b) => a + b, 0)).toBe(100);
      }
    }
  });
});
