import type { Category, Direction, Horizon, JalaliDate, Unit } from '../types';
import type { Num } from './helpers';

export interface Assumptions {
  /** Annual inflation π (fraction). */
  inflation: number;
  /** Risk-free rate / bond YTM (fraction). */
  riskFreeRate: number;
}

export interface MetricContext {
  assumptions: Assumptions;
  snapshotDate: JalaliDate | null;
}

/** Read access to one row; non-finite values come back as null. */
export interface RowAccessor {
  get(id: string): Num;
  text(id: string): string;
}

/** System derived metric (PLAN.md §5.1). */
export interface MetricDef {
  id: string;
  label: string;
  category: Category;
  unit: Unit;
  horizon?: Horizon;
  direction: Direction;
  /** Raw columns or other metric ids this metric reads. */
  requires: string[];
  compute: (r: RowAccessor, ctx: MetricContext) => Num;
  /** Formula and interpretation; shown as a tooltip. */
  description: string;
}
