import type { ScoringConfig } from './types';

export interface Grade {
  grade: string;
  label: string;
}

/** Letter grade for a 0–100 score (PLAN.md §6.6); null for missing scores. */
export function gradeOf(score: number, config: ScoringConfig): Grade | null {
  if (!Number.isFinite(score)) return null;
  const g = config.grades.find((x) => score >= x.min);
  return g ? { grade: g.grade, label: g.label } : null;
}

/** Competition ranking among the given indices: 1 = highest score; ties share a rank. */
export function rankDescending(values: Float64Array, indices: ArrayLike<number>, out: Float64Array): void {
  const valid: number[] = [];
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k] as number;
    if (Number.isFinite(values[i] as number)) valid.push(i);
  }
  valid.sort((a, b) => (values[b] as number) - (values[a] as number));
  valid.forEach((i, k) => {
    const prev = valid[k - 1];
    out[i] = prev !== undefined && values[prev] === values[i] ? (out[prev] as number) : k + 1;
  });
}
