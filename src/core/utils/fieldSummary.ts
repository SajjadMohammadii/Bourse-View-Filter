import { quantile } from './stats';

export interface FieldSummary {
  min: number;
  median: number;
  max: number;
  /** Share of rows with a finite value. */
  coverage: number;
  /** Counts in equal-width bins between p1 and p99 (outliers clamped into the edge bins). */
  bins: number[];
}

export function summarize(values: ArrayLike<number>, binCount = 24): FieldSummary {
  const finite: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (Number.isFinite(v)) finite.push(v);
  }
  finite.sort((a, b) => a - b);
  const bins = new Array<number>(binCount).fill(0);
  if (!finite.length) return { min: NaN, median: NaN, max: NaN, coverage: 0, bins };
  const lo = quantile(finite, 0.01);
  const hi = quantile(finite, 0.99);
  const width = (hi - lo) / binCount || 1;
  for (const v of finite) bins[Math.min(binCount - 1, Math.max(0, Math.floor((v - lo) / width)))]! += 1;
  return {
    min: finite[0] as number,
    median: quantile(finite, 0.5),
    max: finite[finite.length - 1] as number,
    coverage: values.length ? finite.length / values.length : 0,
    bins,
  };
}
