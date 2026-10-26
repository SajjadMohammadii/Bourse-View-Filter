import type { RowAccessor, MetricContext } from '../metrics/types';

/** How a raw metric value becomes a 0–100 score (PLAN.md §6.2). */
export type NormalizerSpec =
  | { kind: 'percentile'; direction: 'higher' | 'lower' }
  | { kind: 'band'; ideal: [number, number]; hard: [number, number] }
  | { kind: 'boolean'; trueScore?: number }
  | { kind: 'linear'; min: number; max: number; direction: 'higher' | 'lower' };

/** Optional value transform applied before normalizing: |x| or inflation-adjusted growth. */
export type MetricTransform = 'abs' | 'real' | 'realQ' | 'realM';

export interface FactorMetric {
  metric: string;
  weight: number;
  normalizer: NormalizerSpec;
  transform?: MetricTransform;
}

export type PeerScope = 'market' | 'sector' | 'industry';

export interface FactorDef {
  id: string;
  label: string;
  weight: number;
  description: string;
  metrics: FactorMetric[];
  peerScope?: PeerScope;
  /** Share of metric weight that must be present (default from scoring config). */
  minCoverage?: number;
}

/** A secondary score built from factors and/or extra metrics (e.g. qTransform, safety). */
export interface DerivedScoreDef {
  id: string;
  label: string;
  description: string;
  parts: Array<{ factor: string; weight: number } | { metric: FactorMetric; weight: number }>;
}

export interface WeightPreset {
  label: string;
  weights: Record<string, number>;
}

export interface ProfileDef {
  id: string;
  label: string;
  description: string;
  defaultPeerScope: PeerScope;
  /** Share of the market percentile in a blended percentile (rest = peer group). Undefined = no blend. */
  peerBlend?: number;
  factors: FactorDef[];
  minCoverage: number;
  /** Rows failing this get no score (shown as "no report"). */
  eligibility?: (r: RowAccessor) => boolean;
  ineligibleLabel?: string;
  weightPresets: Record<string, WeightPreset>;
  derivedScores?: DerivedScoreDef[];
  /** Multiply the score by the stale-statement penalty when enabled in settings. */
  stalePenalty?: boolean;
}

/** Declarative per-industry adjustments (PLAN.md §6.9). */
export interface IndustryOverride {
  id: string;
  label: string;
  industries: string[];
  /** Restrict to these profiles (default: all). */
  profiles?: string[];
  disableMetrics?: string[];
  disableFactors?: string[];
  /** factorId → metrics added for rows in these industries. */
  extraMetrics?: Record<string, FactorMetric[]>;
  /** metricId → weight multiplier. */
  weightMultipliers?: Record<string, number>;
}

export interface FlagDef {
  id: string;
  label: string;
  description: string;
  tone: 'good' | 'bad' | 'neutral';
  requires: string[];
  test: (r: RowAccessor, ctx: FlagContext) => boolean | null;
}

export interface FlagContext extends MetricContext {
  thresholds: { illiquidAvgValue: number; staleStatementDays: number };
}

export interface ScoringConfig {
  minPeerGroupSize: number;
  defaultFactorMinCoverage: number;
  grades: Array<{ min: number; grade: string; label: string }>;
  compositeWeights: Record<string, number>;
}

export type PeerMode = 'default' | 'market' | 'industry' | 'blend';

export interface ScoringOptions {
  peerMode: PeerMode;
  stalePenalty: boolean;
  /** Reduce month-over-month weight around Esfand/Farvardin (PLAN.md §10). */
  seasonality?: boolean;
  /** profileId → factorId → weight (overrides the profile defaults). */
  factorWeights?: Record<string, Record<string, number>>;
  compositeWeights?: Record<string, number>;
  /** User edits to factor metric lists (profileId → factorId → edit). */
  profileEdits?: Record<string, Record<string, { added?: FactorMetric[]; removed?: string[] }>>;
}
