import type { Dataset, JalaliDate } from '../types';
import type { MarketRiskHistory, MarketRiskResult, WeightingMode } from '../market/types';
import { formatJalali, compareJalali } from '../utils/jalali';

/** Compact per-day record stored in IndexedDB (PLAN.md §13). Field arrays align with `symbols`. */
export interface SnapshotRecord {
  key: string;
  date: JalaliDate;
  fileName: string;
  savedAt: number;
  symbols: string[];
  columns: string[];
  fields: Record<string, Float32Array>;
  marketRisk: Record<WeightingMode, RiskReading>;
}

export interface RiskReading {
  thermometer: number | null;
  components: Record<string, number | null>;
}

/** Light index entry (kept separately so listing history never loads full records). */
export type SnapshotMeta = Omit<SnapshotRecord, 'symbols' | 'columns' | 'fields'> & { count: number };

export const snapshotKey = (date: JalaliDate): string => formatJalali(date, '-');

export function buildSnapshot(
  ds: Dataset,
  marketRisk: MarketRiskResult,
  fieldIds: string[],
  savedAt: number,
): SnapshotRecord | null {
  if (!ds.snapshotDate) return null;
  const fields: Record<string, Float32Array> = {};
  for (const id of fieldIds) {
    const col = ds.num[id];
    if (col) fields[id] = Float32Array.from(col, (v) => (Number.isFinite(v) ? v : NaN));
  }
  const risk = {} as Record<WeightingMode, RiskReading>;
  for (const [mode, snap] of Object.entries(marketRisk.modes) as Array<
    [WeightingMode, MarketRiskResult['modes'][WeightingMode]]
  >) {
    risk[mode] = {
      thermometer: snap.thermometer,
      components: Object.fromEntries(snap.components.map((c) => [c.id, c.value])),
    };
  }
  return {
    key: snapshotKey(ds.snapshotDate),
    date: ds.snapshotDate,
    fileName: ds.fileName,
    savedAt,
    symbols: [...ds.symbols],
    columns: Object.keys(ds.meta).filter((id) => ds.meta[id]?.source === 'raw'),
    fields,
    marketRisk: risk,
  };
}

export function metaOf(r: SnapshotRecord): SnapshotMeta {
  return {
    key: r.key,
    date: r.date,
    fileName: r.fileName,
    savedAt: r.savedAt,
    marketRisk: r.marketRisk,
    count: r.symbols.length,
  };
}

/** Index entries sorted oldest → newest. */
export function sortMetas(metas: SnapshotMeta[]): SnapshotMeta[] {
  return [...metas].sort((a, b) => compareJalali(a.date, b.date));
}

/** Most recent snapshot strictly before `date`. */
export function previousOf(metas: SnapshotMeta[], date: JalaliDate): SnapshotMeta | null {
  const before = sortMetas(metas).filter((m) => compareJalali(m.date, date) < 0);
  return before[before.length - 1] ?? null;
}

/** Keys to delete so that at most `retain` snapshots remain (oldest go first). */
export function overRetention(metas: SnapshotMeta[], retain: number): string[] {
  const sorted = sortMetas(metas);
  return sorted.slice(0, Math.max(0, sorted.length - retain)).map((m) => m.key);
}

/** Raw component values of past snapshots for history-based risk normalization (PLAN.md §7.3). */
export function riskHistoryFrom(metas: SnapshotMeta[], excludeKey: string | null): MarketRiskHistory {
  const out: MarketRiskHistory = {};
  for (const m of sortMetas(metas)) {
    if (m.key === excludeKey) continue;
    for (const [mode, r] of Object.entries(m.marketRisk) as Array<[WeightingMode, RiskReading]>) {
      (out[mode] ??= []).push(r.components);
    }
  }
  return out;
}
