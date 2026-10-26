import type { NormalizerSpec } from './types';
import { clamp } from '../metrics/helpers';

/**
 * Absolute normalizers (no peer group needed). Return 0–100 or NaN for missing input.
 * NEGATIVE_BASE (-Infinity) always scores 0 (worst).
 */
export function absoluteScore(v: number, spec: Exclude<NormalizerSpec, { kind: 'percentile' }>): number {
  if (v === -Infinity) return 0;
  if (!Number.isFinite(v)) return NaN;
  switch (spec.kind) {
    case 'band':
      return bandScore(v, spec.ideal, spec.hard);
    case 'linear': {
      const t = clamp((v - spec.min) / (spec.max - spec.min), 0, 1) * 100;
      return spec.direction === 'higher' ? t : 100 - t;
    }
    case 'boolean':
      return v > 0 ? (spec.trueScore ?? 100) : 0;
  }
}

/** 100 inside the ideal band, linear to 0 at the hard limits, 0 beyond. */
export function bandScore(v: number, [lo, hi]: [number, number], [hardLo, hardHi]: [number, number]): number {
  if (v >= lo && v <= hi) return 100;
  if (v < lo) return v <= hardLo ? 0 : ((v - hardLo) / (lo - hardLo)) * 100;
  return v >= hardHi ? 0 : ((hardHi - v) / (hardHi - hi)) * 100;
}

/** Converts a raw percentile (0 = smallest) into a score honoring direction. */
export function directed(pct: number, direction: 'higher' | 'lower'): number {
  return direction === 'higher' ? pct : 100 - pct;
}
