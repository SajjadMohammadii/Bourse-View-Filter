import type { DataHealthReport, Dataset, JalaliDate, Result } from '../core/types';
import { err, ok } from '../core/types';
import { buildDataset } from '../core/data/buildDataset';
import { validateSchema } from '../core/data/schemaValidator';
import { snapshotDateFromFileName } from '../core/data/snapshotDate';
import { computeMetrics, type MetricRunReport } from '../core/metrics/registry';
import type { Assumptions } from '../core/metrics/types';
import { scoreAll } from '../core/scoring/scoreAll';
import type { ScoringOptions } from '../core/scoring/types';
import { computeMarketRisk } from '../core/market/marketRiskEngine';
import type { MarketRiskHistory, MarketRiskResult } from '../core/market/types';
import { columnDefs, columnDictionary, ignoredColumns, textColumns, UNKNOWN_SECTOR } from '../config/columns';
import { derivedMetrics } from '../config/derivedMetrics';
import { defaultAssumptions, thresholds as defaultThresholds } from '../config/assumptions';
import { profiles } from '../config/profiles';
import { industryOverrides, seasonality } from '../config/industryOverrides';
import { allFlags } from '../config/allFlags';
import { scoringConfig, defaultScoringOptions } from '../config/scoring';
import { marketRiskConfig } from '../config/marketRisk';
import { readWorkbook } from './io/readWorkbook';
import { computeCustomMetrics, type CustomMetricDef } from '../core/metrics/customMetrics';
import { applyProfileEdits } from '../core/scoring/customizeProfiles';
import { defaultConstants } from '../core/filters';

/** Everything that changes scores without re-reading the file. */
export interface PipelineOptions {
  assumptions?: Assumptions;
  scoring?: ScoringOptions;
  thresholds?: { illiquidAvgValue: number; staleStatementDays: number };
  riskHistory?: MarketRiskHistory;
  customMetrics?: CustomMetricDef[];
}

export interface LoadRequest extends PipelineOptions {
  buffer: ArrayBuffer;
  fileName: string;
  /** Overrides the date parsed from the file name. */
  snapshotDate?: JalaliDate | null;
}

export interface PipelineResult {
  dataset: Dataset;
  report: DataHealthReport;
  metrics: MetricRunReport;
  marketRisk: MarketRiskResult;
  /** custom metric id → error message (invalid ones are skipped). */
  customErrors: Record<string, string>;
  timings: Record<string, number>;
}

const dictionary = {
  get: (id: string) => columnDictionary.get(id),
  textColumns,
  ignored: ignoredColumns,
  unknownTextFallback: UNKNOWN_SECTOR,
};

/** Raw columns the derived metrics and scoring depend on. */
export function requiredColumns(): string[] {
  const derivedIds = new Set(derivedMetrics.map((d) => d.id));
  const fromMetrics = derivedMetrics.flatMap((d) => d.requires).filter((id) => !derivedIds.has(id));
  return [...new Set(['Symbol', 'Sector', 'Industry', 'Exchange', 'Price', 'MarketCap', ...fromMetrics])];
}

/** Industry overrides plus the seasonality rule when enabled and in season. */
function activeOverrides(options: ScoringOptions, date: JalaliDate | null) {
  const inSeason = options.seasonality && date !== null && seasonality.months.includes(date.m);
  return inSeason ? [...industryOverrides, seasonality.override] : industryOverrides;
}

/** Full load pipeline (PLAN.md §4). */
export function runLoadPipeline(req: LoadRequest): Result<PipelineResult & { rows: unknown[][] }> {
  const t0 = performance.now();
  const rows = readWorkbook(req.buffer);
  if (!rows.ok) return rows;
  const read = performance.now() - t0;
  const r = processRows(rows.value, req);
  if (!r.ok) return r;
  return ok({ ...r.value, rows: rows.value, timings: { read, ...r.value.timings } });
}

/** Steps 2–8 from already-read rows; used on load and on every rescore. */
export function processRows(
  rows: unknown[][],
  req: PipelineOptions & { fileName: string; snapshotDate?: JalaliDate | null },
): Result<PipelineResult> {
  const timings: Record<string, number> = {};
  const lap = (key: string, since: number) => (timings[key] = performance.now() - since);
  let t = performance.now();
  const date = req.snapshotDate ?? snapshotDateFromFileName(req.fileName);
  const built = buildDataset(rows, req.fileName, date, dictionary);
  if (!built.ok) return built;
  const { dataset, stats } = built.value;
  if (dataset.size === 0) return err('NO_ROWS', 'هیچ نماد معتبری در فایل پیدا نشد.');
  const report = validateSchema({
    dataset,
    stats,
    knownColumns: columnDefs.filter((d) => !ignoredColumns.has(d.id)).map((d) => d.id),
    requiredColumns: requiredColumns(),
    unknownSector: UNKNOWN_SECTOR,
  });
  lap('build', t);

  t = performance.now();
  const assumptions = req.assumptions ?? defaultAssumptions;
  const derived = computeMetrics(dataset, derivedMetrics, {
    assumptions,
    snapshotDate: dataset.snapshotDate,
  });
  if (!derived.ok) return derived;
  lap('derive', t);

  t = performance.now();
  const custom = computeCustomMetrics(derived.value.dataset, req.customMetrics ?? [], {
    inflation: assumptions.inflation,
    constants: defaultConstants(assumptions.inflation, assumptions.riskFreeRate),
  });
  lap('custom', t);

  t = performance.now();
  const options = req.scoring ?? defaultScoringOptions;
  const thresholds = { ...defaultThresholds, ...req.thresholds };
  const scored = scoreAll(custom.dataset, {
    profiles: applyProfileEdits(profiles, options.profileEdits),
    overrides: activeOverrides(options, dataset.snapshotDate),
    flags: allFlags,
    config: scoringConfig,
    options,
    flagContext: { assumptions, snapshotDate: dataset.snapshotDate, thresholds },
    stale: { days: thresholds.staleStatementDays, penalty: thresholds.stalePenalty },
  });
  if (!scored.ok) return scored;
  lap('score', t);

  t = performance.now();
  const marketRisk = computeMarketRisk(scored.value.dataset, marketRiskConfig, req.riskHistory);
  lap('market', t);
  return ok({
    dataset: scored.value.dataset,
    report,
    metrics: derived.value.report,
    marketRisk,
    customErrors: custom.errors,
    timings,
  });
}
