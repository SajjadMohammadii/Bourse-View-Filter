import type { Dataset, JalaliDate } from '../core/types';
import type { MarketRiskHistory, MarketRiskResult } from '../core/market/types';
import {
  applyHistory,
  riskSeries,
  symbolSeries,
  type HistoryDiff,
  type SymbolSeries,
} from '../core/history/diff';
import {
  buildSnapshot,
  overRetention,
  previousOf,
  riskHistoryFrom,
  snapshotKey,
  type SnapshotMeta,
  type SnapshotRecord,
} from '../core/history/snapshot';
import { historyRepo, serializeSnapshots, deserializeSnapshots } from './persistence/historyRepo';
import { profiles } from '../config/profiles';

/** Fields kept per snapshot: scores, factors, ranks and a few key metrics (PLAN.md §13). */
export function snapshotFields(ds: Dataset): string[] {
  const keep = new Set([
    'Price',
    'MarketCap',
    'Ret_1D',
    'NetIndividualValue',
    'conf.composite',
    'score.composite',
    'rank.composite',
  ]);
  for (const p of profiles) keep.add(`rank.${p.id}`);
  return Object.keys(ds.num).filter(
    (id) => keep.has(id) || id.startsWith('score.') || id.startsWith('factor.'),
  );
}

export interface HistoryState {
  metas: SnapshotMeta[];
  diff: HistoryDiff | null;
}

/** Owns snapshot history: risk history for the pipeline, Δ columns, saving and retention. */
export class HistoryManager {
  private metas: SnapshotMeta[] = [];
  private previous: SnapshotRecord | null = null;

  async init(): Promise<SnapshotMeta[]> {
    this.metas = await historyRepo.index();
    return this.metas;
  }

  /** Past component values (excluding the same date) for history-based risk scaling. */
  riskHistory(date: JalaliDate | null): MarketRiskHistory {
    return riskHistoryFrom(this.metas, date ? snapshotKey(date) : null);
  }

  /** Loads the previous snapshot for a date; call once per loaded file. */
  async preparePrevious(date: JalaliDate | null): Promise<void> {
    const meta = date ? previousOf(this.metas, date) : null;
    this.previous = meta ? ((await historyRepo.get(meta.key)) ?? null) : null;
  }

  /** Adds Δ / previous-rank columns when a previous snapshot exists. */
  decorate(ds: Dataset): { dataset: Dataset; diff: HistoryDiff | null } {
    if (!this.previous) return { dataset: ds, diff: null };
    return applyHistory(ds, this.previous);
  }

  exists(date: JalaliDate | null): boolean {
    return !!date && this.metas.some((m) => m.key === snapshotKey(date));
  }

  /** Saves today's snapshot and applies retention; returns the updated index. */
  async save(ds: Dataset, risk: MarketRiskResult, retain: number): Promise<SnapshotMeta[]> {
    const record = buildSnapshot(ds, risk, snapshotFields(ds), Date.now());
    if (!record) return this.metas;
    this.metas = await historyRepo.put(record);
    const drop = overRetention(this.metas, retain);
    if (drop.length) this.metas = await historyRepo.remove(drop);
    return this.metas;
  }

  series(ds: Dataset | null, risk: MarketRiskResult | null, mode: 'equal' | 'cap' | 'sqrtCap') {
    const today = ds?.snapshotDate && risk ? { date: ds.snapshotDate, risk } : null;
    return riskSeries(this.metas, today, mode);
  }

  async symbolHistory(symbol: string, fields: string[]): Promise<SymbolSeries> {
    return symbolSeries(await historyRepo.all(), symbol, fields);
  }

  async exportAll(): Promise<string> {
    return serializeSnapshots(await historyRepo.all());
  }

  async importAll(text: string): Promise<number | null> {
    const records = deserializeSnapshots(text);
    if (!records) return null;
    for (const r of records) this.metas = await historyRepo.put(r);
    return records.length;
  }

  async clear(): Promise<void> {
    this.metas = await historyRepo.remove(this.metas.map((m) => m.key));
  }

  get list(): SnapshotMeta[] {
    return this.metas;
  }
}
