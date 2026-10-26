/** Small numeric helpers over Float64Array columns (NaN = null). */

export function finiteValues(xs: ArrayLike<number>, indices?: ArrayLike<number>): number[] {
  const out: number[] = [];
  const n = indices ? indices.length : xs.length;
  for (let k = 0; k < n; k++) {
    const v = xs[indices ? (indices[k] as number) : k] as number;
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

export function median(xs: number[]): number {
  return quantile(
    [...xs].sort((a, b) => a - b),
    0.5,
  );
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Clips values to the [lo, hi] quantiles (PLAN.md §6.4 winsorize at 1%/99%). */
export function winsorize(xs: number[], lo = 0.01, hi = 0.99): number[] {
  if (xs.length < 3) return xs;
  const sorted = [...xs].sort((a, b) => a - b);
  const a = quantile(sorted, lo);
  const b = quantile(sorted, hi);
  return xs.map((x) => Math.min(b, Math.max(a, x)));
}

/**
 * Percentile rank 0–100 of each listed index among the listed indices' finite values.
 * Ties share their average rank. A single value scores 50. Non-finite values are skipped.
 */
export function percentileRanks(
  values: ArrayLike<number>,
  indices: ArrayLike<number>,
  out: Float64Array,
): void {
  const valid: number[] = [];
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k] as number;
    if (Number.isFinite(values[i] as number)) valid.push(i);
  }
  const n = valid.length;
  if (n === 0) return;
  if (n === 1) {
    out[valid[0] as number] = 50;
    return;
  }
  valid.sort((a, b) => (values[a] as number) - (values[b] as number));
  let start = 0;
  while (start < n) {
    let end = start;
    const v = values[valid[start] as number] as number;
    while (end + 1 < n && values[valid[end + 1] as number] === v) end++;
    const pct = ((start + end) / 2 / (n - 1)) * 100;
    for (let k = start; k <= end; k++) out[valid[k] as number] = pct;
    start = end + 1;
  }
}

/** Percentile (0–100) of v among the finite values at `indices` (ties count half). NaN if v is missing. */
export function percentileOf(values: ArrayLike<number>, v: number, indices?: ArrayLike<number>): number {
  if (!Number.isFinite(v)) return NaN;
  let below = 0;
  let equal = 0;
  let n = 0;
  const len = indices ? indices.length : values.length;
  for (let k = 0; k < len; k++) {
    const x = values[indices ? (indices[k] as number) : k] as number;
    if (!Number.isFinite(x)) continue;
    n++;
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return n ? ((below + equal / 2) / n) * 100 : NaN;
}
