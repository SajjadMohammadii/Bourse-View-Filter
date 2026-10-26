import { describe, it, expect } from 'vitest';
import { absoluteScore, bandScore, directed } from '../../../src/core/scoring/normalizers';
import { percentileRanks, winsorize, quantile, median, std } from '../../../src/core/utils/stats';
import { gradeOf, rankDescending } from '../../../src/core/scoring/grades';
import { scoringConfig } from '../../../src/config/scoring';

const pct = (xs: number[]) => {
  const out = new Float64Array(xs.length).fill(NaN);
  percentileRanks(
    Float64Array.from(xs),
    xs.map((_, i) => i),
    out,
  );
  return [...out];
};

describe('percentileRanks', () => {
  it('ranks 0..100 linearly', () => {
    expect(pct([10, 30, 20])).toEqual([0, 100, 50]);
  });
  it('averages ties', () => {
    expect(pct([1, 2, 2, 3])).toEqual([0, 50, 50, 100]);
  });
  it('gives 50 to a single value and skips NaN / -Infinity', () => {
    expect(pct([NaN, 5])).toEqual([NaN, 50]);
    expect(pct([-Infinity, 1, 2])).toEqual([NaN, 0, 100]);
  });
});

describe('absolute normalizers', () => {
  it('band: 100 inside, linear to 0 at hard limits', () => {
    expect(bandScore(60, [50, 68], [25, 85])).toBe(100);
    expect(bandScore(37.5, [50, 68], [25, 85])).toBe(50);
    expect(bandScore(76.5, [50, 68], [25, 85])).toBe(50);
    expect(bandScore(20, [50, 68], [25, 85])).toBe(0);
    expect(bandScore(90, [50, 68], [25, 85])).toBe(0);
  });
  it('linear clamps and honors direction', () => {
    expect(absoluteScore(0, { kind: 'linear', min: -1, max: 1, direction: 'higher' })).toBe(50);
    expect(absoluteScore(5, { kind: 'linear', min: -1, max: 1, direction: 'higher' })).toBe(100);
    expect(absoluteScore(1, { kind: 'linear', min: 0, max: 1, direction: 'lower' })).toBe(0);
  });
  it('boolean and NEGATIVE_BASE', () => {
    expect(absoluteScore(1, { kind: 'boolean' })).toBe(100);
    expect(absoluteScore(0, { kind: 'boolean', trueScore: 80 })).toBe(0);
    expect(absoluteScore(-Infinity, { kind: 'band', ideal: [0, 1], hard: [-1, 2] })).toBe(0);
    expect(absoluteScore(NaN, { kind: 'boolean' })).toBeNaN();
  });
  it('directed flips for lower-is-better', () => {
    expect(directed(20, 'lower')).toBe(80);
  });
});

describe('stats', () => {
  it('quantile / median / std / winsorize', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    const w = winsorize([...Array.from({ length: 99 }, (_, i) => i), 10_000]);
    expect(Math.max(...w)).toBeLessThan(10_000);
  });
});

describe('grades and ranks', () => {
  it('maps scores to grades (PLAN.md §6.6)', () => {
    expect(gradeOf(80, scoringConfig)?.grade).toBe('A');
    expect(gradeOf(79.9, scoringConfig)?.grade).toBe('B');
    expect(gradeOf(50, scoringConfig)?.grade).toBe('C');
    expect(gradeOf(35, scoringConfig)?.label).toBe('ضعیف');
    expect(gradeOf(10, scoringConfig)?.grade).toBe('E');
    expect(gradeOf(NaN, scoringConfig)).toBeNull();
  });
  it('competition ranking, 1 = best, ties share rank', () => {
    const v = Float64Array.from([50, 90, NaN, 90, 10]);
    const out = new Float64Array(5).fill(NaN);
    rankDescending(v, [0, 1, 2, 3, 4], out);
    expect([...out]).toEqual([3, 1, NaN, 1, 4]);
  });
});
