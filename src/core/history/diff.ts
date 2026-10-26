import type { Dataset, FieldMeta, JalaliDate } from '../types';
import type { SnapshotMeta, SnapshotRecord } from './snapshot';
import { sortMetas } from './snapshot';
import type { MarketRiskResult, WeightingMode } from '../market/types';
import { formatJalali } from '../utils/jalali';

export interface HistoryDiff {
  previousKey: string;
  newSymbols: string[];
  removedSymbols: string[];
  newColumns: string[];
  removedColumns: string[];
}

/**
 * Adds history-derived columns: `delta.score.<id>` (today − previous) for every stored score,
 * and `prev.<field>` for previous ranks (PLAN.md §13).
 */
export function applyHistory(input: Dataset, prev: SnapshotRecord): { dataset: Dataset; diff: HistoryDiff } {
  const ds: Dataset = { ...input, num: { ...input.num }, meta: { ...input.meta } };
  const prevIndex = new Map(prev.symbols.map((s, i) => [s, i]));
  for (const [field, values] of Object.entries(prev.fields)) {
    const current = ds.num[field];
    if (!current) continue;
    const prevCol = new Float64Array(ds.size).fill(NaN);
    ds.symbols.forEach((s, i) => {
      const k = prevIndex.get(s);
      if (k !== undefined) prevCol[i] = values[k] as number;
    });
    if (field.startsWith('score.')) {
      const id = `delta.${field}`;
      ds.num[id] = Float64Array.from(current, (v, i) => v - (prevCol[i] as number));
      ds.meta[id] = meta(id, `تغییر ${ds.meta[field]?.label ?? field}`, 'score', 'higher');
    }
    if (field.startsWith('rank.')) {
      const id = `prev.${field}`;
      ds.num[id] = prevCol;
      ds.meta[id] = meta(id, `${ds.meta[field]?.label ?? field} (اسنپ‌شات قبل)`, 'rank', 'lower');
    }
  }
  const today = new Set(ds.symbols);
  const prevCols = new Set(prev.columns);
  const rawCols = Object.keys(ds.meta).filter((id) => ds.meta[id]?.source === 'raw');
  return {
    dataset: ds,
    diff: {
      previousKey: prev.key,
      newSymbols: ds.symbols.filter((s) => !prevIndex.has(s)),
      removedSymbols: prev.symbols.filter((s) => !today.has(s)),
      newColumns: rawCols.filter((c) => !prevCols.has(c)),
      removedColumns: prev.columns.filter((c) => !rawCols.includes(c)),
    },
  };
}

function meta(
  id: string,
  label: string,
  unit: FieldMeta['unit'],
  direction: FieldMeta['direction'],
): FieldMeta {
  return { id, label, category: 'score', unit, direction, source: 'score', kind: 'num' };
}

export interface RiskSeriesData {
  labels: string[];
  thermometer: Array<number | null>;
  breadth: Array<number | null>;
}

/** Thermometer + breadth over stored snapshots plus today (today replaces a same-day snapshot). */
export function riskSeries(
  metas: SnapshotMeta[],
  today: { date: JalaliDate; risk: MarketRiskResult } | null,
  mode: WeightingMode,
): RiskSeriesData {
  const rows = sortMetas(metas)
    .filter((m) => !today || m.key !== formatJalali(today.date, '-'))
    .map((m) => ({
      date: m.date,
      thermometer: m.marketRisk[mode]?.thermometer ?? null,
      breadth: m.marketRisk[mode]?.components['breadth'] ?? null,
    }));
  if (today) {
    const snap = today.risk.modes[mode];
    rows.push({
      date: today.date,
      thermometer: snap.thermometer,
      breadth: snap.components.find((c) => c.id === 'breadth')?.value ?? null,
    });
    rows.sort((a, b) => a.date.y - b.date.y || a.date.m - b.date.m || a.date.d - b.date.d);
  }
  return {
    labels: rows.map((r) => formatJalali(r.date)),
    thermometer: rows.map((r) => r.thermometer),
    breadth: rows.map((r) => r.breadth),
  };
}

export interface SymbolSeries {
  labels: string[];
  series: Record<string, Array<number | null>>;
}

/** One symbol's stored values across snapshots (for sparklines). */
export function symbolSeries(records: SnapshotRecord[], symbol: string, fields: string[]): SymbolSeries {
  const sorted = [...records].sort(
    (a, b) => a.date.y - b.date.y || a.date.m - b.date.m || a.date.d - b.date.d,
  );
  const series: Record<string, Array<number | null>> = Object.fromEntries(fields.map((f) => [f, []]));
  for (const r of sorted) {
    const i = r.symbols.indexOf(symbol);
    for (const f of fields) {
      const v = i >= 0 ? r.fields[f]?.[i] : undefined;
      (series[f] as Array<number | null>).push(v !== undefined && Number.isFinite(v) ? v : null);
    }
  }
  return { labels: sorted.map((r) => formatJalali(r.date)), series };
}
