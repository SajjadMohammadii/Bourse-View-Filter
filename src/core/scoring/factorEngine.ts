import type { Dataset } from '../types';
import type { FactorDef, FactorMetric, IndustryOverride, PeerScope } from './types';
import { absoluteScore, directed } from './normalizers';
import { marketPercentile, peerPercentile, type PeerIndex } from './peerGroups';
import { realGrowth } from '../metrics/helpers';

/** How percentile metrics are ranked for one factor: market, peers, or a blend of both. */
export interface RankScope {
  scope: PeerScope;
  /** Weight of the market percentile when blending (0..1); undefined = no blend. */
  blend?: number;
}

export interface NormalizeContext {
  ds: Dataset;
  peers: PeerIndex;
  minPeerSize: number;
  inflation: number;
  cache: Map<string, Float64Array>;
}

const PERIODS = { real: 1, realQ: 4, realM: 12 } as const;

/** Raw values after the optional transform (|x| or inflation-adjusted growth). */
export function transformedValues(ctx: NormalizeContext, fm: FactorMetric): Float64Array | null {
  const raw = ctx.ds.num[fm.metric];
  if (!raw || !fm.transform) return raw ?? null;
  const key = `t|${fm.metric}|${fm.transform}`;
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const out = new Float64Array(raw.length);
  const t = fm.transform;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i] as number;
    if (t === 'abs') out[i] = v === -Infinity ? v : Math.abs(v);
    else out[i] = Number.isFinite(v) ? (realGrowth(v, ctx.inflation, PERIODS[t]) as number) : v;
  }
  ctx.cache.set(key, out);
  return out;
}

/** 0–100 score column for one factor metric (NaN where the value is missing). */
export function metricScores(ctx: NormalizeContext, fm: FactorMetric, rank: RankScope): Float64Array {
  const spec = fm.normalizer;
  const key = `s|${fm.metric}|${fm.transform ?? ''}|${JSON.stringify(spec)}|${rank.scope}|${rank.blend ?? ''}`;
  const hit = ctx.cache.get(key);
  if (hit) return hit;
  const values = transformedValues(ctx, fm);
  const n = ctx.ds.size;
  const out = new Float64Array(n).fill(NaN);
  if (values) {
    if (spec.kind === 'percentile') fillPercentile(ctx, values, spec.direction, rank, out);
    else for (let i = 0; i < n; i++) out[i] = absoluteScore(values[i] as number, spec);
  }
  ctx.cache.set(key, out);
  return out;
}

function fillPercentile(
  ctx: NormalizeContext,
  values: Float64Array,
  direction: 'higher' | 'lower',
  rank: RankScope,
  out: Float64Array,
): void {
  const market = marketPercentile(values, ctx.peers);
  const usePeers = rank.scope !== 'market' || rank.blend !== undefined;
  const start = rank.scope === 'sector' ? 'sector' : 'industry';
  const peer = usePeers ? peerPercentile(values, ctx.peers, ctx.minPeerSize, market, start) : market;
  const w = rank.blend ?? (rank.scope === 'market' ? 1 : 0);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (v === -Infinity) out[i] = 0;
    else if (Number.isFinite(v))
      out[i] = directed(w * (market[i] as number) + (1 - w) * (peer[i] as number), direction);
  }
}

export interface FactorResult {
  score: Float64Array;
  /** Present metric weight / total metric weight (0..1). */
  coverage: Float64Array;
  /** Rows for which the factor does not apply (disabled factor or all its metrics disabled). */
  disabled: Uint8Array;
}

interface WeightedMetric {
  fm: FactorMetric;
  scores: Float64Array;
  /** Override id that adds this metric (undefined = base metric). */
  extraOf?: string;
}

/**
 * Weighted mean of present metric scores per row; weights of missing metrics are
 * redistributed. Coverage below minCoverage → NaN (PLAN.md §6.5).
 */
export function scoreFactor(
  ctx: NormalizeContext,
  factor: FactorDef,
  rank: RankScope,
  minCoverage: number,
  rowOverrides: IndustryOverride[][],
): FactorResult {
  const n = ctx.ds.size;
  const metrics = factorMetrics(ctx, factor, rank, rowOverrides);
  const result: FactorResult = {
    score: new Float64Array(n).fill(NaN),
    coverage: new Float64Array(n),
    disabled: new Uint8Array(n),
  };
  for (let i = 0; i < n; i++) {
    const overrides = rowOverrides[i] ?? [];
    if (overrides.some((o) => o.disableFactors?.includes(factor.id))) {
      result.disabled[i] = 1;
      continue;
    }
    let total = 0;
    let present = 0;
    let sum = 0;
    for (const wm of metrics) {
      const w = rowWeight(wm, overrides);
      if (w <= 0) continue;
      total += w;
      const s = wm.scores[i] as number;
      if (Number.isNaN(s)) continue;
      present += w;
      sum += w * s;
    }
    if (total === 0) {
      // Every metric is disabled for this row: the factor does not apply (not "missing").
      result.disabled[i] = 1;
      continue;
    }
    const cov = present / total;
    result.coverage[i] = cov;
    if (cov >= minCoverage) result.score[i] = sum / present;
  }
  return result;
}

function factorMetrics(
  ctx: NormalizeContext,
  factor: FactorDef,
  rank: RankScope,
  rowOverrides: IndustryOverride[][],
): WeightedMetric[] {
  const list: WeightedMetric[] = factor.metrics.map((fm) => ({ fm, scores: metricScores(ctx, fm, rank) }));
  const seen = new Set<string>();
  for (const overrides of rowOverrides) {
    for (const o of overrides) {
      if (seen.has(o.id)) continue;
      seen.add(o.id);
      for (const fm of o.extraMetrics?.[factor.id] ?? []) {
        list.push({ fm, scores: metricScores(ctx, fm, rank), extraOf: o.id });
      }
    }
  }
  return list;
}

function rowWeight(wm: WeightedMetric, overrides: IndustryOverride[]): number {
  if (wm.extraOf && !overrides.some((o) => o.id === wm.extraOf)) return 0;
  let w = wm.fm.weight;
  for (const o of overrides) {
    if (o.disableMetrics?.includes(wm.fm.metric)) return 0;
    w *= o.weightMultipliers?.[wm.fm.metric] ?? 1;
  }
  return w;
}
