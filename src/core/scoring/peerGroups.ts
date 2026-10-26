import type { Dataset } from '../types';
import { percentileRanks } from '../utils/stats';

export interface PeerIndex {
  /** group key → row indices */
  industry: Map<string, number[]>;
  sector: Map<string, number[]>;
  all: number[];
  industryOf: string[];
  sectorOf: string[];
}

export function buildPeerIndex(ds: Dataset): PeerIndex {
  const industryOf = ds.text['Industry'] ?? new Array<string>(ds.size).fill('');
  const sectorOf = ds.text['Sector'] ?? new Array<string>(ds.size).fill('');
  const group = (keys: string[]) => {
    const m = new Map<string, number[]>();
    keys.forEach((k, i) => {
      const list = m.get(k) ?? [];
      list.push(i);
      m.set(k, list);
    });
    return m;
  };
  return {
    industry: group(industryOf),
    sector: group(sectorOf),
    all: Array.from({ length: ds.size }, (_, i) => i),
    industryOf,
    sectorOf,
  };
}

/** Market-wide percentile (0–100, NaN when missing). */
export function marketPercentile(values: Float64Array, peers: PeerIndex): Float64Array {
  const out = new Float64Array(values.length).fill(NaN);
  percentileRanks(values, peers.all, out);
  return out;
}

/**
 * Peer percentile (PLAN.md §6.3): industry when it has ≥ minSize valid values,
 * otherwise sector (≥ minSize), otherwise the whole market.
 */
export function peerPercentile(
  values: Float64Array,
  peers: PeerIndex,
  minSize: number,
  market: Float64Array,
  start: 'industry' | 'sector' = 'industry',
): Float64Array {
  const out = new Float64Array(values.length).fill(NaN);
  const resolved = new Uint8Array(values.length);
  const industries = start === 'industry' ? peers.industry.values() : [];
  for (const idx of industries) {
    if (validCount(values, idx) < minSize) continue;
    percentileRanks(values, idx, out);
    for (const i of idx) resolved[i] = 1;
  }
  const scratch = new Float64Array(values.length);
  for (const idx of peers.sector.values()) {
    if (validCount(values, idx) < minSize || idx.every((i) => resolved[i])) continue;
    scratch.fill(NaN);
    percentileRanks(values, idx, scratch);
    for (const i of idx) {
      if (resolved[i]) continue;
      out[i] = scratch[i] as number;
      resolved[i] = 1;
    }
  }
  for (let i = 0; i < values.length; i++) if (!resolved[i]) out[i] = market[i] as number;
  return out;
}

function validCount(values: Float64Array, idx: number[]): number {
  let n = 0;
  for (const i of idx) if (Number.isFinite(values[i] as number)) n++;
  return n;
}
