import type { Dataset, FieldMeta, Result } from '../types';
import { err, ok } from '../types';
import type {
  FlagContext,
  FlagDef,
  IndustryOverride,
  ProfileDef,
  ScoringConfig,
  ScoringOptions,
} from './types';
import { buildPeerIndex } from './peerGroups';
import { scoreProfile, type ProfileScores } from './profileEngine';
import { gradeOf, rankDescending } from './grades';
import { computeFlags } from './flags';

export interface ScoreAllInput {
  profiles: readonly ProfileDef[];
  overrides: readonly IndustryOverride[];
  flags: readonly FlagDef[];
  config: ScoringConfig;
  options: ScoringOptions;
  flagContext: FlagContext;
  stale: { days: number; penalty: number };
}

export const MIN_FACTORS = 4;
export const MAX_FACTORS = 8;

/** Load-time assertion (PLAN.md §6.2): 4 ≤ factors ≤ 8, unique ids, positive weights. */
export function validateProfile(p: ProfileDef): string[] {
  const errors: string[] = [];
  if (p.factors.length < MIN_FACTORS || p.factors.length > MAX_FACTORS) {
    errors.push(
      `پروفایل ${p.id}: تعداد فاکتورها باید بین ${MIN_FACTORS} و ${MAX_FACTORS} باشد (${p.factors.length}).`,
    );
  }
  const ids = p.factors.map((f) => f.id);
  if (new Set(ids).size !== ids.length) errors.push(`پروفایل ${p.id}: شناسه فاکتور تکراری.`);
  for (const f of p.factors) {
    if (!(f.weight > 0)) errors.push(`پروفایل ${p.id}: وزن فاکتور ${f.id} باید مثبت باشد.`);
    if (!f.metrics.length) errors.push(`پروفایل ${p.id}: فاکتور ${f.id} متریک ندارد.`);
  }
  return errors;
}

/** Scores every profile, the composite and the flags; returns a new dataset with score fields. */
export function scoreAll(
  input: Dataset,
  cfg: ScoreAllInput,
): Result<{ dataset: Dataset; profiles: ProfileScores[] }> {
  const invalid = cfg.profiles.flatMap(validateProfile);
  if (invalid.length) return err('INVALID_PROFILE', invalid.join(' '));

  const ds: Dataset = { ...input, num: { ...input.num }, text: { ...input.text }, meta: { ...input.meta } };
  const peers = buildPeerIndex(ds);
  const norm = {
    ds,
    peers,
    minPeerSize: cfg.config.minPeerGroupSize,
    inflation: cfg.flagContext.assumptions.inflation,
    cache: new Map(),
  };
  const run = { norm, config: cfg.config, options: cfg.options, overrides: cfg.overrides, stale: cfg.stale };

  const results = cfg.profiles.map((p) => scoreProfile(run, p));
  results.forEach((r, k) => writeProfile(ds, r, cfg.profiles[k] as ProfileDef, cfg.config, peers.industry));

  const composite = compositeScore(
    results,
    cfg.options.compositeWeights ?? cfg.config.compositeWeights,
    ds.size,
  );
  writeScore(ds, 'composite', 'امتیاز ترکیبی', composite, cfg.config, peers.industry);
  ds.num['conf.composite'] = compositeConfidence(
    results,
    cfg.options.compositeWeights ?? cfg.config.compositeWeights,
    ds.size,
  );
  ds.meta['conf.composite'] = meta(
    'conf.composite',
    'اطمینان ترکیبی',
    'percent',
    'higher',
    'میانگین وزنی اطمینان پروفایل‌های واجد شرایط',
  );

  const flags = computeFlags(ds, cfg.flags, cfg.flagContext);
  for (const def of cfg.flags) {
    ds.num[`flag.${def.id}`] = flags[def.id] as Float64Array;
    ds.meta[`flag.${def.id}`] = meta(`flag.${def.id}`, def.label, 'flag', 'neutral', def.description);
  }
  return ok({ dataset: ds, profiles: results });
}

function writeProfile(
  ds: Dataset,
  r: ProfileScores,
  p: ProfileDef,
  config: ScoringConfig,
  industries: Map<string, number[]>,
): void {
  writeScore(ds, r.id, p.label, r.score, config, industries, p.description);
  ds.num[`conf.${r.id}`] = r.conf;
  ds.meta[`conf.${r.id}`] = meta(
    `conf.${r.id}`,
    `اطمینان ${p.label}`,
    'percent',
    'higher',
    'وزن پوشش‌داده‌شده ÷ کل وزن',
  );
  ds.num[`eligible.${r.id}`] = Float64Array.from(r.eligible);
  ds.meta[`eligible.${r.id}`] = meta(`eligible.${r.id}`, `واجد شرایط ${p.label}`, 'flag', 'neutral');
  for (const f of p.factors) {
    const id = `factor.${r.id}.${f.id}`;
    ds.num[id] = (r.factors[f.id] as { score: Float64Array }).score;
    ds.meta[id] = meta(id, `${f.id} ${f.label}`, 'score', 'higher', f.description);
  }
  for (const d of p.derivedScores ?? []) {
    writeScore(ds, d.id, d.label, r.derived[d.id] as Float64Array, config, industries, d.description);
  }
}

function writeScore(
  ds: Dataset,
  id: string,
  label: string,
  score: Float64Array,
  config: ScoringConfig,
  industries: Map<string, number[]>,
  description?: string,
): void {
  ds.num[`score.${id}`] = score;
  ds.meta[`score.${id}`] = meta(`score.${id}`, `امتیاز ${label}`, 'score', 'higher', description);
  const rank = new Float64Array(ds.size).fill(NaN);
  rankDescending(
    score,
    Array.from({ length: ds.size }, (_, i) => i),
    rank,
  );
  ds.num[`rank.${id}`] = rank;
  ds.meta[`rank.${id}`] = meta(`rank.${id}`, `رتبه ${label} در بازار`, 'rank', 'lower');
  const inInd = new Float64Array(ds.size).fill(NaN);
  for (const idx of industries.values()) rankDescending(score, idx, inInd);
  ds.num[`rankInIndustry.${id}`] = inInd;
  ds.meta[`rankInIndustry.${id}`] = meta(`rankInIndustry.${id}`, `رتبه ${label} در صنعت`, 'rank', 'lower');
  ds.text[`grade.${id}`] = Array.from(score, (s) => gradeOf(s, config)?.grade ?? '');
  ds.meta[`grade.${id}`] = { ...meta(`grade.${id}`, `درجه ${label}`, 'text', 'neutral'), kind: 'text' };
}

/** Weighted mean of available profile scores; missing profiles' weight is redistributed (§6.8). */
export function compositeScore(
  results: ProfileScores[],
  weights: Record<string, number>,
  n: number,
): Float64Array {
  const out = new Float64Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    let w = 0;
    let s = 0;
    for (const r of results) {
      const wi = weights[r.id] ?? 0;
      const v = r.score[i] as number;
      if (wi <= 0 || Number.isNaN(v)) continue;
      w += wi;
      s += wi * v;
    }
    if (w > 0) out[i] = s / w;
  }
  return out;
}

/** Weighted mean of profile confidences over the profiles a symbol is eligible for. */
export function compositeConfidence(
  results: ProfileScores[],
  weights: Record<string, number>,
  n: number,
): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let w = 0;
    let s = 0;
    for (const r of results) {
      const wi = weights[r.id] ?? 0;
      if (wi <= 0 || !r.eligible[i]) continue;
      w += wi;
      s += wi * (r.conf[i] as number);
    }
    out[i] = w > 0 ? s / w : 0;
  }
  return out;
}

function meta(
  id: string,
  label: string,
  unit: FieldMeta['unit'],
  direction: FieldMeta['direction'],
  description?: string,
): FieldMeta {
  return { id, label, category: 'score', unit, direction, description, source: 'score', kind: 'num' };
}
