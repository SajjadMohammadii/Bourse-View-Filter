import type {
  DerivedScoreDef,
  IndustryOverride,
  PeerMode,
  ProfileDef,
  ScoringConfig,
  ScoringOptions,
} from './types';
import {
  metricScores,
  scoreFactor,
  type FactorResult,
  type NormalizeContext,
  type RankScope,
} from './factorEngine';
import { rowAccessor } from '../metrics/registry';

/** Wildcard industry for overrides that apply to every row (e.g. seasonality). */
export const ALL_INDUSTRIES = '*';

export interface ProfileScores {
  id: string;
  score: Float64Array;
  conf: Float64Array;
  eligible: Uint8Array;
  factors: Record<string, FactorResult>;
  derived: Record<string, Float64Array>;
}

export interface ProfileRunContext {
  norm: NormalizeContext;
  config: ScoringConfig;
  options: ScoringOptions;
  overrides: readonly IndustryOverride[];
  stale: { days: number; penalty: number };
}

/** Scores one profile end to end (PLAN.md §6.1–6.5). */
export function scoreProfile(run: ProfileRunContext, profile: ProfileDef): ProfileScores {
  const n = run.norm.ds.size;
  const eligible = eligibilityMask(run, profile);
  const rowOverrides = overridesPerRow(run, profile);
  const weights = factorWeights(profile, run.options);
  const factors: Record<string, FactorResult> = {};
  for (const f of profile.factors) {
    const minCov = f.minCoverage ?? run.config.defaultFactorMinCoverage;
    const res = scoreFactor(
      run.norm,
      f,
      rankScope(profile, f.peerScope, run.options.peerMode),
      minCov,
      rowOverrides,
    );
    for (let i = 0; i < n; i++) if (!eligible[i]) res.score[i] = NaN;
    factors[f.id] = res;
  }
  const { score, conf } = aggregate(profile, factors, weights, eligible, n);
  if (run.options.stalePenalty && profile.stalePenalty) applyStalePenalty(run, score);
  const derived: Record<string, Float64Array> = {};
  for (const d of profile.derivedScores ?? [])
    derived[d.id] = derivedScore(run, profile, d, factors, eligible);
  return { id: profile.id, score, conf, eligible, factors, derived };
}

/** Resolves market/peer/blend ranking for a factor under the global peer mode toggle. */
export function rankScope(
  profile: ProfileDef,
  factorScope: ProfileDef['defaultPeerScope'] | undefined,
  mode: PeerMode,
): RankScope {
  if (mode === 'market') return { scope: 'market' };
  if (mode === 'industry') return { scope: 'industry' };
  if (mode === 'blend') return { scope: 'industry', blend: 0.5 };
  const scope = factorScope ?? profile.defaultPeerScope;
  return profile.peerBlend !== undefined && scope !== 'market'
    ? { scope, blend: profile.peerBlend }
    : { scope };
}

function factorWeights(profile: ProfileDef, options: ScoringOptions): Record<string, number> {
  const custom = options.factorWeights?.[profile.id] ?? {};
  return Object.fromEntries(profile.factors.map((f) => [f.id, custom[f.id] ?? f.weight]));
}

function eligibilityMask(run: ProfileRunContext, profile: ProfileDef): Uint8Array {
  const n = run.norm.ds.size;
  const mask = new Uint8Array(n).fill(1);
  if (!profile.eligibility) return mask;
  const acc = rowAccessor(run.norm.ds);
  for (let i = 0; i < n; i++) {
    acc.i = i;
    mask[i] = profile.eligibility(acc) ? 1 : 0;
  }
  return mask;
}

function overridesPerRow(run: ProfileRunContext, profile: ProfileDef): IndustryOverride[][] {
  const relevant = run.overrides.filter((o) => !o.profiles || o.profiles.includes(profile.id));
  const industry = run.norm.peers.industryOf;
  const cache = new Map<string, IndustryOverride[]>();
  return industry.map((ind) => {
    let hit = cache.get(ind);
    if (!hit) {
      hit = relevant.filter((o) => o.industries.includes(ind) || o.industries.includes(ALL_INDUSTRIES));
      cache.set(ind, hit);
    }
    return hit;
  });
}

function aggregate(
  profile: ProfileDef,
  factors: Record<string, FactorResult>,
  weights: Record<string, number>,
  eligible: Uint8Array,
  n: number,
) {
  const score = new Float64Array(n).fill(NaN);
  const conf = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!eligible[i]) continue;
    let total = 0;
    let present = 0;
    let sum = 0;
    let covered = 0;
    for (const f of profile.factors) {
      const r = factors[f.id];
      const w = weights[f.id] ?? 0;
      if (!r || w <= 0 || r.disabled[i]) continue;
      total += w;
      covered += w * (r.coverage[i] as number);
      const s = r.score[i] as number;
      if (Number.isNaN(s)) continue;
      present += w;
      sum += w * s;
    }
    conf[i] = total > 0 ? covered / total : 0;
    if (total > 0 && present / total >= profile.minCoverage) score[i] = sum / present;
  }
  return { score, conf };
}

function applyStalePenalty(run: ProfileRunContext, score: Float64Array): void {
  const age = run.norm.ds.num['D_StatementAgeDays'];
  if (!age) return;
  for (let i = 0; i < score.length; i++) {
    if ((age[i] as number) > run.stale.days) score[i] = (score[i] as number) * run.stale.penalty;
  }
}

function derivedScore(
  run: ProfileRunContext,
  profile: ProfileDef,
  def: DerivedScoreDef,
  factors: Record<string, FactorResult>,
  eligible: Uint8Array,
): Float64Array {
  const n = run.norm.ds.size;
  const parts = def.parts.map((p) => ({
    weight: p.weight,
    scores:
      'factor' in p
        ? (factors[p.factor]?.score ?? new Float64Array(n).fill(NaN))
        : metricScores(run.norm, p.metric, rankScope(profile, undefined, run.options.peerMode)),
  }));
  const out = new Float64Array(n).fill(NaN);
  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  for (let i = 0; i < n; i++) {
    if (!eligible[i]) continue;
    let present = 0;
    let sum = 0;
    for (const p of parts) {
      const s = p.scores[i] as number;
      if (Number.isNaN(s)) continue;
      present += p.weight;
      sum += p.weight * s;
    }
    if (totalW > 0 && present / totalW >= run.config.defaultFactorMinCoverage) out[i] = sum / present;
  }
  return out;
}
