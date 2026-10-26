/** Persian, position-aware errors for the filter language (PLAN.md §11.8). */
export class FilterError extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number = start + 1,
    readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'FilterError';
  }
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] as number;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min((prev[j] as number) + 1, (prev[j - 1] as number) + 1, diag + cost);
      diag = tmp;
    }
  }
  return prev[b.length] as number;
}

/** Closest candidate within a distance proportional to the name length. */
export function suggest(name: string, candidates: Iterable<string>): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestD = Math.max(2, Math.floor(name.length / 3)) + 1;
  for (const c of candidates) {
    const d = levenshtein(lower, c.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
