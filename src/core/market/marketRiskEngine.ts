import type { Dataset } from '../types';
import type {
  ComponentReading,
  MarketRiskConfig,
  MarketRiskHistory,
  MarketRiskResult,
  MarketRiskSnapshot,
  MarketView,
  SectorRisk,
  WeightingMode,
} from './types';
import { clamp } from '../metrics/helpers';
import { std, winsorize } from '../utils/stats';

export const WEIGHTING_MODES: WeightingMode[] = ['equal', 'cap', 'sqrtCap'];

/** Per-symbol weights for a weighting mode; symbols without a market cap get 0 in cap modes. */
export function weightsFor(ds: Dataset, mode: WeightingMode): Float64Array {
  const cap = ds.num['MarketCap'];
  const w = new Float64Array(ds.size);
  for (let i = 0; i < ds.size; i++) {
    const c = cap?.[i] ?? NaN;
    w[i] = mode === 'equal' ? 1 : Number.isFinite(c) && c > 0 ? (mode === 'cap' ? c : Math.sqrt(c)) : 0;
  }
  return w;
}

export function createView(ds: Dataset, indices: number[], weights: Float64Array): MarketView {
  const num = (field: string, i: number): number => ds.num[field]?.[i] ?? NaN;
  return {
    count: indices.length,
    num,
    wmean(field, winsor = true) {
      const rows = indices.filter((i) => Number.isFinite(num(field, i)) && (weights[i] as number) > 0);
      if (!rows.length) return null;
      const raw = rows.map((i) => num(field, i));
      const vals = winsor ? winsorize(raw) : raw;
      let s = 0;
      let w = 0;
      rows.forEach((i, k) => {
        s += (vals[k] as number) * (weights[i] as number);
        w += weights[i] as number;
      });
      return w > 0 ? s / w : null;
    },
    share(pred) {
      let yes = 0;
      let total = 0;
      for (const i of indices) {
        const r = pred(i);
        const w = weights[i] as number;
        if (r === null || w <= 0) continue;
        total += w;
        if (r) yes += w;
      }
      return total > 0 ? yes / total : null;
    },
    sum(field) {
      const vals = indices.map((i) => num(field, i)).filter(Number.isFinite);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    },
    crossStd(field) {
      const s = std(indices.map((i) => num(field, i)).filter(Number.isFinite));
      return Number.isFinite(s) ? s : null;
    },
  };
}

/** Maps a raw component value to 0–100 risk using its absolute scale. */
export function absoluteRisk(value: number, [atZero, atHundred]: [number, number]): number {
  return clamp(((value - atZero) / (atHundred - atZero)) * 100, 0, 100);
}

/** Risk as the percentile of today's value within the market's own history (PLAN.md §7.3). */
export function historicalRisk(value: number, past: number[], [atZero, atHundred]: [number, number]): number {
  const below = past.filter((x) => x < value).length;
  const equal = past.filter((x) => x === value).length;
  const pct = ((below + equal / 2) / past.length) * 100;
  return atHundred > atZero ? pct : 100 - pct;
}

export function snapshotFor(
  view: MarketView,
  mode: WeightingMode,
  config: MarketRiskConfig,
  history: Array<Record<string, number | null>> = [],
): MarketRiskSnapshot {
  const useHistory = history.length >= config.minHistory;
  const components: ComponentReading[] = config.components.map((c) => {
    const value = c.compute(view);
    const past = history
      .map((h) => h[c.id])
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
    const risk =
      value === null
        ? null
        : useHistory && past.length >= config.minHistory
          ? historicalRisk(value, past, c.scale)
          : absoluteRisk(value, c.scale);
    return { id: c.id, label: c.label, value, risk, weight: c.weight };
  });
  let w = 0;
  let s = 0;
  for (const c of components) {
    if (c.risk === null) continue;
    w += c.weight;
    s += c.weight * c.risk;
  }
  const thermometer = w > 0 ? s / w : null;
  const regime = thermometer === null ? null : (config.regimes.find((r) => thermometer < r.max) ?? null);
  return { mode, thermometer, regime, components, historyBased: useHistory };
}

/** Market thermometer for all weighting modes, overall and per sector. */
export function computeMarketRisk(
  ds: Dataset,
  config: MarketRiskConfig,
  history: MarketRiskHistory = {},
): MarketRiskResult {
  const all = Array.from({ length: ds.size }, (_, i) => i);
  const sectors = groupBy(ds.text['Sector'] ?? [], all);
  const modes = {} as MarketRiskResult['modes'];
  const bySector = {} as MarketRiskResult['bySector'];
  for (const mode of WEIGHTING_MODES) {
    const weights = weightsFor(ds, mode);
    modes[mode] = snapshotFor(createView(ds, all, weights), mode, config, history[mode]);
    bySector[mode] = [...sectors].map(([sector, idx]): SectorRisk => {
      const view = createView(ds, idx, weights);
      return {
        sector,
        count: idx.length,
        snapshot: snapshotFor(view, mode, config),
        netIndividualValue: view.sum('NetIndividualValue'),
      };
    });
  }
  const eq = createView(ds, all, weightsFor(ds, 'equal'));
  const above = eq.share((i) => {
    const p = eq.num('Price', i);
    const s = eq.num('SMA_200D', i);
    return Number.isFinite(p) && Number.isFinite(s) ? p > s : null;
  });
  return {
    modes,
    bySector,
    stats: { netIndividualValue: eq.sum('NetIndividualValue'), pctAboveSma200: above, count: ds.size },
  };
}

function groupBy(keys: string[], indices: number[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const i of indices) {
    const k = keys[i] ?? '';
    const list = m.get(k) ?? [];
    list.push(i);
    m.set(k, list);
  }
  return m;
}
