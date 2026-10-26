import { describe, it, expect } from 'vitest';
import {
  absoluteRisk,
  historicalRisk,
  weightsFor,
  computeMarketRisk,
} from '../../../src/core/market/marketRiskEngine';
import { marketRiskConfig } from '../../../src/config/marketRisk';
import { miniDataset } from '../../helpers/mini';

describe('market risk engine', () => {
  it('maps values to risk using absolute scales in either direction', () => {
    expect(absoluteRisk(0.45, [0.7, 0.2])).toBeCloseTo(50);
    expect(absoluteRisk(0.9, [0.7, 0.2])).toBe(0);
    expect(absoluteRisk(0.03, [0.015, 0.045])).toBeCloseTo(50);
  });
  it('maps values to risk by percentile of history', () => {
    const past = Array.from({ length: 20 }, (_, i) => i);
    expect(historicalRisk(19.5, past, [0, 1])).toBe(100);
    expect(historicalRisk(19.5, past, [1, 0])).toBe(0);
  });
  it('builds weights for the three modes', () => {
    const ds = miniDataset([{ MarketCap: 100 }, { MarketCap: 400 }, { MarketCap: null }]);
    expect([...weightsFor(ds, 'equal')]).toEqual([1, 1, 1]);
    expect([...weightsFor(ds, 'cap')]).toEqual([100, 400, 0]);
    expect([...weightsFor(ds, 'sqrtCap')]).toEqual([10, 20, 0]);
  });
  it('computes a bounded thermometer per mode and per sector, and switches to history after 20 snapshots', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      Sector: i % 2 ? 'الف' : 'ب',
      MarketCap: 1e12 * (i + 1),
      Price: 100,
      SMA_50D: 90 + i,
      SMA_200D: 95,
      DailyChange: i % 3 ? 0.01 : -0.01,
      RSI: 40 + i,
      NetIndividual: 0.01,
      StdDev_90D: 0.02,
      Ret_1M: 0.01 * i,
    }));
    const ds = miniDataset(rows);
    const r = computeMarketRisk(ds, marketRiskConfig);
    for (const mode of ['equal', 'cap', 'sqrtCap'] as const) {
      const t = r.modes[mode].thermometer ?? NaN;
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(100);
      expect(r.bySector[mode]).toHaveLength(2);
    }
    expect(r.modes.equal.historyBased).toBe(false);
    const history = Array.from({ length: 20 }, () => ({ breadth: 0.5 }));
    expect(computeMarketRisk(ds, marketRiskConfig, { equal: history }).modes.equal.historyBased).toBe(true);
  });
  it('component weights sum to 1', () => {
    expect(marketRiskConfig.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1);
  });
});
