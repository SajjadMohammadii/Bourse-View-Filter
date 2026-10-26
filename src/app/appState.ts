import type { DataHealthReport, Dataset, Result } from '../core/types';
import type { MarketRiskResult } from '../core/market/types';
import {
  compile,
  catalogFromDataset,
  defaultConstants,
  runFilter,
  type Compiled,
  type EvalContext,
  type FieldCatalog,
} from '../core/filters';
import { Store } from './store';
import { PipelineClient } from './workerClient';
import { defaultSettings, settingsRepo, type AppSettings } from './settings';
import { combineExpressions, emptyQuickFilters, quickToExpression, type QuickFilters } from './filterState';
import type { PipelineOptions } from './pipeline';
import type { CustomMetricDef } from '../core/metrics/customMetrics';
import type { FilterPreset } from '../config/filterPresets';
import type { FactorMetric } from '../core/scoring/types';
import { lastFileRepo } from './persistence/repos';
import { Library } from './library';
import { HistoryManager } from './historyManager';
import type { HistoryDiff } from '../core/history/diff';
import type { SnapshotMeta } from '../core/history/snapshot';
import { snapshotDateFromFileName } from '../core/data/snapshotDate';
import { formatJalali } from '../core/utils/jalali';

export type LoadStatus = 'empty' | 'loading' | 'ready' | 'error';

export interface FilterErrorView {
  message: string;
  start: number;
  end: number;
}

/** Market-risk time series across stored snapshots (PLAN.md §13). */
export interface RiskSeries {
  labels: string[];
  thermometer: Array<number | null>;
  breadth: Array<number | null>;
}

export interface AppState {
  status: LoadStatus;
  /** True while scores are being recomputed after a settings change. */
  rescoring: boolean;
  dataset: Dataset | null;
  report: DataHealthReport | null;
  marketRisk: MarketRiskResult | null;
  error: string | null;
  timings: Record<string, number>;
  settings: AppSettings;
  filterText: string;
  quick: QuickFilters;
  filterError: FilterErrorView | null;
  /** Row indices passing the global filter (all rows when no filter). */
  visible: number[];
  selected: string | null;
  riskSeries: RiskSeries | null;
  customMetrics: CustomMetricDef[];
  /** custom metric id → error from the last pipeline run. */
  customErrors: Record<string, string>;
  userPresets: FilterPreset[];
  /** Bumped when page-local view state changes and data pages must re-render. */
  renderTick: number;
  /** Stored snapshots (light index) and the diff against the previous one. */
  history: SnapshotMeta[];
  historyDiff: HistoryDiff | null;
}

const initial: AppState = {
  status: 'empty',
  rescoring: false,
  dataset: null,
  report: null,
  marketRisk: null,
  error: null,
  timings: {},
  settings: structuredClone(defaultSettings),
  filterText: '',
  quick: emptyQuickFilters,
  filterError: null,
  visible: [],
  selected: null,
  riskSeries: null,
  customMetrics: [],
  customErrors: {},
  userPresets: [],
  renderTick: 0,
  history: [],
  historyDiff: null,
};

/** Debounce for recomputing scores after weight/assumption edits (PLAN.md §4). */
const RESCORE_DEBOUNCE_MS = 300;

/** Application facade used by the UI layer (use-cases live here, not in components). */
export class App {
  readonly store = new Store<AppState>(initial);
  readonly library = new Library(this);
  readonly history = new HistoryManager();
  /** UI hook: asked before replacing a stored snapshot of the same date (PLAN.md §13). */
  confirmReplace: (dateLabel: string) => Promise<boolean> = () => Promise.resolve(true);
  private readonly client = new PipelineClient();
  private rescoreTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    this.store.set({ settings: await settingsRepo.load() });
    await this.library.init();
    this.store.set({ history: await this.history.init() });
  }

  /** Reloads the last file from IndexedDB so a page refresh keeps the session (PLAN.md §15 phase 7). */
  async restoreLastFile(): Promise<void> {
    const f = await lastFileRepo.get();
    if (f) await this.loadBuffer(f.buffer, f.name, false);
  }

  async loadFile(file: File): Promise<void> {
    await this.loadBuffer(await file.arrayBuffer(), file.name, true);
  }

  private async loadBuffer(buffer: ArrayBuffer, fileName: string, remember: boolean): Promise<void> {
    this.store.set({ status: 'loading', error: null });
    if (remember) void lastFileRepo.put({ name: fileName, buffer: buffer.slice(0) });
    const date = snapshotDateFromFileName(fileName);
    await this.history.preparePrevious(date);
    const result = await this.client.load({
      buffer,
      fileName,
      ...this.pipelineOptions(),
      riskHistory: this.history.riskHistory(date),
    });
    if (!result.ok) {
      this.store.set({ status: this.store.get().dataset ? 'ready' : 'error', error: result.error.message });
      return;
    }
    const { report, marketRisk, timings, customErrors } = result.value;
    const { dataset, diff } = this.history.decorate(result.value.dataset);
    this.store.set({
      status: 'ready',
      report,
      timings,
      customErrors,
      historyDiff: diff,
      error: null,
      ...this.withFilter(dataset, marketRisk),
    });
    if (remember) await this.saveSnapshot(dataset, marketRisk);
    this.refreshRiskSeries();
  }

  private async saveSnapshot(dataset: Dataset, risk: MarketRiskResult): Promise<void> {
    const date = dataset.snapshotDate;
    if (!date) return;
    if (this.history.exists(date) && !(await this.confirmReplace(formatJalali(date)))) return;
    this.store.set({
      history: await this.history.save(dataset, risk, this.store.get().settings.historyRetention),
    });
  }

  private refreshRiskSeries(): void {
    const { dataset, marketRisk, settings } = this.store.get();
    const series = this.history.series(dataset, marketRisk, settings.marketRiskMode);
    this.store.set({ riskSeries: series.labels.length ? series : null });
  }

  /** Persists settings; when scoring inputs changed, recomputes scores (debounced). */
  updateSettings(patch: Partial<AppSettings>, rescore = true): void {
    const settings = { ...this.store.get().settings, ...patch };
    this.store.set({ settings });
    void settingsRepo.save(settings);
    if (patch.marketRiskMode) this.refreshRiskSeries();
    if (rescore) this.scheduleRescore();
  }

  setFilterText(text: string): void {
    this.store.set({ filterText: text });
    this.refilter();
  }

  setQuickFilters(quick: QuickFilters): void {
    this.store.set({ quick });
    this.refilter();
  }

  /** Asks data pages to re-render (page-local view state changed). */
  requestRender(): void {
    this.store.set({ renderTick: this.store.get().renderTick + 1 });
  }

  /** Adds a metric (e.g. a custom one) to a factor; persisted in settings and rescored. */
  addMetricToFactor(profileId: string, factorId: string, metric: FactorMetric): void {
    const scoring = this.store.get().settings.scoring;
    const edits = structuredClone(scoring.profileEdits ?? {});
    const fe = (edits[profileId] ??= {})[factorId] ?? {};
    fe.added = [...(fe.added ?? []).filter((m) => m.metric !== metric.metric), metric];
    fe.removed = (fe.removed ?? []).filter((id) => id !== metric.metric);
    (edits[profileId] as Record<string, typeof fe>)[factorId] = fe;
    this.updateSettings({ scoring: { ...scoring, profileEdits: edits } });
  }

  removeMetricFromFactor(profileId: string, factorId: string, metricId: string): void {
    const scoring = this.store.get().settings.scoring;
    const edits = structuredClone(scoring.profileEdits ?? {});
    const fe = (edits[profileId] ??= {})[factorId] ?? {};
    const wasAdded = (fe.added ?? []).some((m) => m.metric === metricId);
    fe.added = (fe.added ?? []).filter((m) => m.metric !== metricId);
    if (!wasAdded) fe.removed = [...new Set([...(fe.removed ?? []), metricId])];
    (edits[profileId] as Record<string, typeof fe>)[factorId] = fe;
    this.updateSettings({ scoring: { ...scoring, profileEdits: edits } });
  }

  select(symbol: string | null): void {
    this.store.set({ selected: symbol });
  }

  catalog(): FieldCatalog | null {
    const { dataset, settings } = this.store.get();
    return dataset ? catalogFromDataset(dataset, this.constants(settings)) : null;
  }

  evalContext(): EvalContext | null {
    const { dataset, settings } = this.store.get();
    return dataset
      ? { ds: dataset, inflation: settings.assumptions.inflation, constants: this.constants(settings) }
      : null;
  }

  compile(text: string): Result<Compiled> | null {
    const catalog = this.catalog();
    return catalog ? compile(text, catalog) : null;
  }

  /** Narrows indices by an extra (page-level) expression; invalid/empty expressions keep all. */
  narrow(indices: number[], text: string): number[] {
    if (!text.trim()) return indices;
    const c = this.compile(text);
    const ctx = this.evalContext();
    if (!c?.ok || !ctx) return indices;
    const mask = runFilter(c.value, ctx);
    return indices.filter((i) => mask[i]);
  }

  private constants(settings: AppSettings): Record<string, number> {
    return defaultConstants(settings.assumptions.inflation, settings.assumptions.riskFreeRate);
  }

  private pipelineOptions(): PipelineOptions {
    const { settings: s, customMetrics, dataset } = this.store.get();
    return {
      assumptions: s.assumptions,
      scoring: s.scoring,
      thresholds: s.thresholds,
      customMetrics,
      riskHistory: this.history.riskHistory(dataset?.snapshotDate ?? null),
    };
  }

  /** Recomputes scores soon (debounced); a no-op until a file is loaded. */
  scheduleRescore(): void {
    if (!this.store.get().dataset) return;
    if (this.rescoreTimer) clearTimeout(this.rescoreTimer);
    this.rescoreTimer = setTimeout(() => void this.rescore(), RESCORE_DEBOUNCE_MS);
  }

  private async rescore(): Promise<void> {
    this.store.set({ rescoring: true });
    const result = await this.client.rescore(this.pipelineOptions());
    if (!result.ok) {
      this.store.set({ rescoring: false, error: result.error.message });
      return;
    }
    const { marketRisk, timings, customErrors } = result.value;
    const { dataset, diff } = this.history.decorate(result.value.dataset);
    this.store.set({
      rescoring: false,
      timings,
      customErrors,
      historyDiff: diff,
      ...this.withFilter(dataset, marketRisk),
    });
    this.refreshRiskSeries();
  }

  private refilter(): void {
    const { dataset, marketRisk } = this.store.get();
    if (dataset) this.store.set(this.withFilter(dataset, marketRisk));
  }

  /** Dataset plus the global filter result (text + quick chips). */
  private withFilter(dataset: Dataset, marketRisk: MarketRiskResult | null): Partial<AppState> {
    const { filterText, quick, settings } = this.store.get();
    const all = Array.from({ length: dataset.size }, (_, i) => i);
    const expr = combineExpressions(quickToExpression(quick), filterText);
    if (!expr) return { dataset, marketRisk, visible: all, filterError: null };
    const constants = this.constants(settings);
    const c = compile(expr, catalogFromDataset(dataset, constants));
    if (!c.ok) {
      const d = (c.error.details ?? {}) as { start?: number; end?: number };
      return {
        dataset,
        marketRisk,
        visible: all,
        filterError: { message: c.error.message, start: d.start ?? 0, end: d.end ?? 0 },
      };
    }
    const mask = runFilter(c.value, { ds: dataset, inflation: settings.assumptions.inflation, constants });
    return { dataset, marketRisk, visible: all.filter((i) => mask[i]), filterError: null };
  }
}
