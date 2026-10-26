import type { Unit } from '../types';

export type WeightingMode = 'equal' | 'cap' | 'sqrtCap';

/** Aggregations over a set of symbols with per-symbol weights. */
export interface MarketView {
  readonly count: number;
  /** Weighted mean of finite values (winsorized at 1%/99% by default). */
  wmean(field: string, winsor?: boolean): number | null;
  /** Weighted share of rows where pred is true, among rows where it is not null. */
  share(pred: (i: number) => boolean | null): number | null;
  sum(field: string): number | null;
  /** Unweighted cross-sectional standard deviation. */
  crossStd(field: string): number | null;
  num(field: string, i: number): number;
}

export interface MarketRiskComponentDef {
  id: string;
  label: string;
  description: string;
  unit: Unit;
  weight: number;
  /** [value where risk = 0, value where risk = 100]; linear and clamped in between. */
  scale: [number, number];
  compute: (v: MarketView) => number | null;
}

export interface MarketRegime {
  max: number;
  id: string;
  label: string;
}

export interface MarketRiskConfig {
  components: MarketRiskComponentDef[];
  regimes: MarketRegime[];
  /** Snapshots needed before risk is measured against the market's own history. */
  minHistory: number;
}

export interface ComponentReading {
  id: string;
  label: string;
  value: number | null;
  risk: number | null;
  weight: number;
}

export interface MarketRiskSnapshot {
  mode: WeightingMode;
  thermometer: number | null;
  regime: MarketRegime | null;
  components: ComponentReading[];
  historyBased: boolean;
}

export interface SectorRisk {
  sector: string;
  count: number;
  snapshot: MarketRiskSnapshot;
  netIndividualValue: number | null;
}

export interface MarketRiskResult {
  modes: Record<WeightingMode, MarketRiskSnapshot>;
  bySector: Record<WeightingMode, SectorRisk[]>;
  stats: { netIndividualValue: number | null; pctAboveSma200: number | null; count: number };
}

/** Raw component values of past snapshots, per weighting mode. */
export type MarketRiskHistory = Partial<Record<WeightingMode, Array<Record<string, number | null>>>>;
