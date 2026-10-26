import type { FactorMetric, MetricTransform } from '../../core/scoring/types';

/** Shorthands for declaring factor metrics in profile configs. */
export const pct = (
  metric: string,
  direction: 'higher' | 'lower' = 'higher',
  weight = 1,
  transform?: MetricTransform,
): FactorMetric => ({
  metric,
  weight,
  normalizer: { kind: 'percentile', direction },
  ...(transform ? { transform } : {}),
});

export const up = (metric: string, weight = 1, transform?: MetricTransform): FactorMetric =>
  pct(metric, 'higher', weight, transform);
export const down = (metric: string, weight = 1, transform?: MetricTransform): FactorMetric =>
  pct(metric, 'lower', weight, transform);

export const band = (
  metric: string,
  ideal: [number, number],
  hard: [number, number],
  weight = 1,
): FactorMetric => ({ metric, weight, normalizer: { kind: 'band', ideal, hard } });

export const linear = (
  metric: string,
  min: number,
  max: number,
  weight = 1,
  direction: 'higher' | 'lower' = 'higher',
): FactorMetric => ({
  metric,
  weight,
  normalizer: { kind: 'linear', min, max, direction },
});

export const bool = (metric: string, weight = 1): FactorMetric => ({
  metric,
  weight,
  normalizer: { kind: 'boolean' },
});
