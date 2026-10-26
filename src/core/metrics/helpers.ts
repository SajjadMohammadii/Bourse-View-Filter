/**
 * Arithmetic helpers for derived metrics (PLAN.md §5.1).
 * Every helper is null-propagating: any null/non-finite input yields null.
 */

/**
 * Marker for ratios whose base is negative/zero in a way that makes the ratio meaningless
 * (e.g. P/E with a loss). Stored as -Infinity; normalizers score it as the worst value,
 * the filter language treats it as null.
 */
export const NEGATIVE_BASE = -Infinity;

export type Num = number | null;

export const isNum = (x: Num | undefined): x is number => typeof x === 'number' && Number.isFinite(x);

export function safeDiv(a: Num, b: Num): Num {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return a / b;
}

/** a / b where b must be positive; b ≤ 0 → NEGATIVE_BASE (worst). */
export function divPositiveBase(a: Num, b: Num): Num {
  if (!isNum(a) || !isNum(b)) return null;
  return b <= 0 ? NEGATIVE_BASE : a / b;
}

/** a / |b| — keeps the sign of the numerator meaningful when the base can be negative. */
export function divAbs(a: Num, b: Num): Num {
  return isNum(b) ? safeDiv(a, Math.abs(b)) : null;
}

/** Relative change (a − b) / |b|. */
export function relChange(a: Num, b: Num): Num {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return (a - b) / Math.abs(b);
}

export function sub(a: Num, b: Num): Num {
  return isNum(a) && isNum(b) ? a - b : null;
}

export function add(...xs: Num[]): Num {
  let s = 0;
  for (const x of xs) {
    if (!isNum(x)) return null;
    s += x;
  }
  return s;
}

export function mul(...xs: Num[]): Num {
  let p = 1;
  for (const x of xs) {
    if (!isNum(x)) return null;
    p *= x;
  }
  return p;
}

export function abs(x: Num): Num {
  return isNum(x) ? Math.abs(x) : null;
}

export function coalesce(...xs: Num[]): Num {
  for (const x of xs) if (isNum(x)) return x;
  return null;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Per-period inflation from an annual rate: (1+π)^(1/periods) − 1. */
export function periodInflation(annual: number, periodsPerYear = 1): number {
  return Math.pow(1 + annual, 1 / periodsPerYear) - 1;
}

/** Real growth (1+g)/(1+π_p) − 1, where π_p is the inflation of one period. */
export function realGrowth(g: Num, annualInflation: number, periodsPerYear = 1): Num {
  if (!isNum(g)) return null;
  return (1 + g) / (1 + periodInflation(annualInflation, periodsPerYear)) - 1;
}

/** Share of true values among the evaluable booleans; null when none are evaluable. */
export function boolMean(flags: Array<boolean | null>): Num {
  const known = flags.filter((f): f is boolean => f !== null);
  if (!known.length) return null;
  return known.filter(Boolean).length / known.length;
}

/** a > b, or null when either side is missing. */
export function gt(a: Num, b: Num): boolean | null {
  return isNum(a) && isNum(b) ? a > b : null;
}
