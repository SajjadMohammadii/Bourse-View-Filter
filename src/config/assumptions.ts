import type { Assumptions } from '../core/metrics/types';

/** Editable defaults (PLAN.md §5.1, §17.8). Users should update these in Settings. */
export const defaultAssumptions: Assumptions = {
  inflation: 0.35,
  riskFreeRate: 0.3,
};

export const thresholds = {
  /** AvgVal_20D below this (rial) raises flag.illiquid — 2 میلیارد تومان. */
  illiquidAvgValue: 2e10,
  /** Financial statements older than this many days are "stale". */
  staleStatementDays: 200,
  /** Optional score multiplier for stale statements. */
  stalePenalty: 0.9,
  /** Midpoint (months ago) of the trailing-12-month window, for real run-rate comparisons. */
  ttmMidpointMonths: 6.5,
};
