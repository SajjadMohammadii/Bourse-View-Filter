import type { ScoringConfig, ScoringOptions } from '../core/scoring/types';

/** Global scoring constants (PLAN.md §6.3–6.8). No magic numbers in engines. */
export const scoringConfig: ScoringConfig = {
  minPeerGroupSize: 10,
  defaultFactorMinCoverage: 0.5,
  grades: [
    { min: 80, grade: 'A', label: 'عالی' },
    { min: 65, grade: 'B', label: 'خوب' },
    { min: 50, grade: 'C', label: 'متوسط' },
    { min: 35, grade: 'D', label: 'ضعیف' },
    { min: -Infinity, grade: 'E', label: 'بسیار ضعیف' },
  ],
  compositeWeights: {
    technical: 0.3,
    fundamentalLong: 0.3,
    fundamentalQuarterly: 0.25,
    fundamentalMonthly: 0.15,
  },
};

export const defaultScoringOptions: ScoringOptions = {
  peerMode: 'default',
  stalePenalty: false,
};
