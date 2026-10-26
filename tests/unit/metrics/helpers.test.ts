import { describe, it, expect } from 'vitest';
import {
  NEGATIVE_BASE,
  safeDiv,
  divPositiveBase,
  divAbs,
  relChange,
  realGrowth,
  periodInflation,
  boolMean,
  coalesce,
  add,
  mul,
} from '../../../src/core/metrics/helpers';
import { topoSort } from '../../../src/core/utils/graph';

describe('metric helpers', () => {
  it('safeDiv returns null on zero/null', () => {
    expect(safeDiv(1, 0)).toBeNull();
    expect(safeDiv(null, 2)).toBeNull();
    expect(safeDiv(6, 3)).toBe(2);
  });
  it('divPositiveBase marks a non-positive base as NEGATIVE_BASE', () => {
    expect(divPositiveBase(10, -5)).toBe(NEGATIVE_BASE);
    expect(divPositiveBase(10, 0)).toBe(NEGATIVE_BASE);
    expect(divPositiveBase(10, 5)).toBe(2);
    expect(divPositiveBase(null, 5)).toBeNull();
  });
  it('divAbs and relChange keep the sign of the numerator', () => {
    expect(divAbs(5, -10)).toBe(0.5);
    expect(relChange(5, -10)).toBe(1.5);
    expect(relChange(5, 0)).toBeNull();
  });
  it('realGrowth deflates by period inflation', () => {
    expect(realGrowth(0.35, 0.35)).toBeCloseTo(0);
    expect(realGrowth(0.5, 0.35)).toBeCloseTo(1.5 / 1.35 - 1);
    expect(periodInflation(0.35, 4)).toBeCloseTo(Math.pow(1.35, 0.25) - 1);
    expect(realGrowth(0.1, 0.35, 12)).toBeCloseTo(1.1 / Math.pow(1.35, 1 / 12) - 1);
    expect(realGrowth(null, 0.35)).toBeNull();
  });
  it('boolMean ignores unknowns', () => {
    expect(boolMean([true, false, null])).toBe(0.5);
    expect(boolMean([null])).toBeNull();
  });
  it('coalesce/add/mul propagate null', () => {
    expect(coalesce(null, 3)).toBe(3);
    expect(add(1, null)).toBeNull();
    expect(mul(2, 3, 4)).toBe(24);
  });
});

describe('topoSort', () => {
  it('orders dependencies first and ignores external ids', () => {
    const deps: Record<string, string[]> = { a: ['b', 'raw'], b: ['c'], c: [] };
    const r = topoSort(['a', 'b', 'c'], (id) => deps[id] ?? []);
    expect(r.ok && r.value).toEqual(['c', 'b', 'a']);
  });
  it('reports cycles in Persian with the path', () => {
    const deps: Record<string, string[]> = { C_a: ['C_b'], C_b: ['C_a'] };
    const r = topoSort(['C_a', 'C_b'], (id) => deps[id] ?? []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe('وابستگی چرخه‌ای: C_a → C_b → C_a');
  });
});
