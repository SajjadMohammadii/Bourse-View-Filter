import { describe, it, expect } from 'vitest';
import { loadSample } from '../helpers/sample';
import { profiles } from '../../src/config/profiles';

/** Golden symbols (PLAN.md §14.2). Update the snapshot deliberately when weights change: `npx vitest -u`. */
const GOLDEN = ['ذوب', 'فولاد', 'فملی', 'شستا', 'خودرو', 'وبملت', 'فارس', 'شپنا', 'اخابر', 'کگل'];

const round = (v: number | undefined) =>
  v === undefined || Number.isNaN(v) ? null : Math.round(v * 100) / 100;

describe('golden scores on screener-plus-1405-08-04', () => {
  const { dataset: ds, marketRisk } = loadSample();
  const present = GOLDEN.filter((s) => ds.symbols.includes(s));

  it('finds the golden symbols', () => {
    expect(present.length).toBeGreaterThanOrEqual(9);
  });

  it('matches the stored snapshot', () => {
    const snap: Record<string, Record<string, number | string | null>> = {};
    for (const sym of present) {
      const i = ds.symbols.indexOf(sym);
      const row: Record<string, number | string | null> = {};
      for (const p of profiles) {
        row[`score.${p.id}`] = round(ds.num[`score.${p.id}`]?.[i]);
        row[`conf.${p.id}`] = round(ds.num[`conf.${p.id}`]?.[i]);
        row[`grade.${p.id}`] = ds.text[`grade.${p.id}`]?.[i] ?? null;
        for (const f of p.factors)
          row[`factor.${p.id}.${f.id}`] = round(ds.num[`factor.${p.id}.${f.id}`]?.[i]);
      }
      row['score.composite'] = round(ds.num['score.composite']?.[i]);
      snap[sym] = row;
    }
    expect(snap).toMatchSnapshot();
  });

  it('keeps every score in [0, 100] with no infinities (missing data never leaks NaN into valid scores)', () => {
    for (const [id, col] of Object.entries(ds.num)) {
      if (!/^(score|factor)\./.test(id)) continue;
      for (const v of col) {
        if (Number.isNaN(v)) continue;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    for (const p of profiles) {
      const score = ds.num[`score.${p.id}`]!;
      for (let i = 0; i < ds.size; i++) {
        const allFactors = p.factors.every((f) => Number.isFinite(ds.num[`factor.${p.id}.${f.id}`]![i]!));
        if (allFactors) expect(Number.isFinite(score[i]!)).toBe(true);
      }
    }
  });

  it('produces a market thermometer for all modes', () => {
    for (const mode of ['equal', 'cap', 'sqrtCap'] as const) {
      expect(marketRisk.modes[mode].thermometer).not.toBeNull();
      expect(marketRisk.bySector[mode].length).toBeGreaterThanOrEqual(11);
    }
  });
});
