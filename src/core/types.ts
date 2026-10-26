/** Shared domain types. Pure data — no DOM, no storage. */

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export interface AppError {
  code: string;
  /** Persian, user-facing message. */
  message: string;
  details?: unknown;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = (code: string, message: string, details?: unknown): Result<never> => ({
  ok: false,
  error: { code, message, details },
});

export type Category =
  | 'identity'
  | 'price'
  | 'size'
  | 'incomeAnnual'
  | 'incomeQuarterly'
  | 'incomeMonthly'
  | 'balance'
  | 'ratioProfitability'
  | 'ratioEfficiency'
  | 'ratioLeverage'
  | 'ratioCashflow'
  | 'valuation'
  | 'growthAnnual'
  | 'growthQuarterly'
  | 'growthMonthly'
  | 'returns'
  | 'risk'
  | 'liquidity'
  | 'flow'
  | 'technicalTrend'
  | 'technicalMomentum'
  | 'technicalVolume'
  | 'technicalLevels'
  | 'technicalCycle'
  | 'derived'
  | 'custom'
  | 'score'
  | 'uncategorized';

export type Unit =
  | 'text'
  | 'number'
  | 'ratio'
  | 'percent'
  | 'rial'
  | 'days'
  | 'times'
  | 'price'
  | 'volume'
  | 'score'
  | 'flag'
  | 'rank'
  | 'date';

export type Direction = 'higher' | 'lower' | 'band' | 'neutral';
export type Horizon = 'long' | 'quarter' | 'month' | 'technical';
export type FieldSource = 'raw' | 'derived' | 'custom' | 'score';
export type FieldKind = 'num' | 'text';

/** Static dictionary entry for a known Excel column (PLAN.md §1.3). */
export interface ColumnDef {
  id: string;
  label: string;
  category: Category;
  unit: Unit;
  horizon?: Horizon;
  direction: Direction;
  description?: string;
  /** Other column ids that carry the same information. */
  aliases?: string[];
  kind?: FieldKind;
}

/** Runtime metadata for every field in a Dataset. */
export interface FieldMeta {
  id: string;
  label: string;
  category: Category;
  unit: Unit;
  direction: Direction;
  horizon?: Horizon;
  description?: string;
  aliases?: string[];
  source: FieldSource;
  kind: FieldKind;
}

export interface JalaliDate {
  y: number;
  m: number;
  d: number;
}

/** Column-oriented in-memory dataset (PLAN.md §3.3). Numeric null = NaN. */
export interface Dataset {
  snapshotDate: JalaliDate | null;
  fileName: string;
  size: number;
  symbols: string[];
  text: Record<string, string[]>;
  num: Record<string, Float64Array>;
  meta: Record<string, FieldMeta>;
}

export interface ColumnCoverage {
  id: string;
  label: string;
  category: Category;
  kind: FieldKind;
  filled: number;
  coverage: number;
  nonNumericCells: number;
}

export interface DataHealthReport {
  rowCount: number;
  columnCount: number;
  droppedColumns: string[];
  renamedColumns: Array<{ from: string; to: string }>;
  unknownColumns: string[];
  missingColumns: string[];
  /** Missing columns that scoring depends on. */
  missingRequired: string[];
  duplicateSymbols: string[];
  emptySymbolRows: number;
  noSectorSymbols: string[];
  nonNumericCells: number;
  implausible: Array<{ symbol: string; column: string; value: number; reason: string }>;
  coverage: ColumnCoverage[];
  warnings: string[];
}
