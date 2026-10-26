import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { processRows } from '../../src/app/pipeline';
import {
  buildSnapshot,
  previousOf,
  overRetention,
  riskHistoryFrom,
  metaOf,
  snapshotKey,
  type SnapshotMeta,
} from '../../src/core/history/snapshot';
import { applyHistory, riskSeries, symbolSeries } from '../../src/core/history/diff';
import { serializeSnapshots, deserializeSnapshots, historyRepo } from '../../src/app/persistence/historyRepo';
import { HistoryManager, snapshotFields } from '../../src/app/historyManager';
import { resetDbForTests } from '../../src/app/persistence/db';
import { sampleRows, SAMPLE_NAME } from '../helpers/sample';
import { secondDayRows, SECOND_NAME, ADDED, REMOVED } from '../helpers/secondDay';

function run(rows: unknown[][], fileName: string) {
  const r = processRows(rows, { fileName });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const day1 = run(sampleRows(), SAMPLE_NAME);
const day2 = run(secondDayRows(sampleRows()), SECOND_NAME);
const snap1 = buildSnapshot(day1.dataset, day1.marketRisk, snapshotFields(day1.dataset), 1)!;
const snap2 = buildSnapshot(day2.dataset, day2.marketRisk, snapshotFields(day2.dataset), 2)!;

describe('snapshots', () => {
  it('stores scores, factors, ranks and key metrics compactly', () => {
    expect(snap1.key).toBe('1405-08-04');
    expect(snap1.symbols).toHaveLength(957);
    expect(Object.keys(snap1.fields)).toEqual(
      expect.arrayContaining([
        'score.technical',
        'score.composite',
        'rank.composite',
        'factor.technical.T1',
        'Price',
      ]),
    );
    expect(snap1.fields['score.technical']).toBeInstanceOf(Float32Array);
    expect(snap1.marketRisk.equal.thermometer).not.toBeNull();
  });

  it('finds the previous snapshot and applies retention oldest-first', () => {
    const metas: SnapshotMeta[] = [metaOf(snap2), metaOf(snap1)];
    expect(previousOf(metas, snap2.date)?.key).toBe('1405-08-04');
    expect(previousOf(metas, snap1.date)).toBeNull();
    expect(overRetention(metas, 1)).toEqual(['1405-08-04']);
    expect(overRetention(metas, 5)).toEqual([]);
  });

  it('builds risk history per mode excluding the current day', () => {
    const h = riskHistoryFrom([metaOf(snap1), metaOf(snap2)], snapshotKey(snap2.date));
    expect(h.equal).toHaveLength(1);
    expect(h.cap?.[0]?.['breadth']).toBeCloseTo(snap1.marketRisk.cap.components['breadth'] ?? NaN);
  });
});

describe('phase 8 acceptance: Δ column and newcomers between two dated files', () => {
  const { dataset: ds, diff } = applyHistory(day2.dataset, snap1);

  it('Δ score = today − previous for every symbol present on both days', () => {
    for (const p of ['technical', 'composite']) {
      const delta = ds.num[`delta.score.${p}`]!;
      for (const sym of ['فملی', 'شستا', 'وبملت']) {
        const i = ds.symbols.indexOf(sym);
        const k = day1.dataset.symbols.indexOf(sym);
        const expected =
          day2.dataset.num[`score.${p}`]![i]! - Math.fround(day1.dataset.num[`score.${p}`]![k]!);
        expect(delta[i]).toBeCloseTo(expected, 6);
      }
    }
    expect(ds.num['delta.score.technical']![ds.symbols.indexOf(ADDED)]).toBeNaN();
  });

  it('reports new / removed symbols', () => {
    expect(diff.newSymbols).toEqual([ADDED]);
    expect(diff.removedSymbols.sort()).toEqual([...REMOVED].sort());
    expect(diff.previousKey).toBe('1405-08-04');
  });

  it('previous composite ranks identify Top-20 newcomers', () => {
    const prevRank = ds.num['prev.rank.composite']!;
    const rank = ds.num['rank.composite']!;
    const top20 = ds.symbols.filter((_, i) => rank[i]! <= 20);
    const newcomers = top20.filter((s) => !(prevRank[ds.symbols.indexOf(s)]! <= 20));
    const k = (s: string) => day1.dataset.symbols.indexOf(s);
    for (const s of newcomers) expect(k(s) < 0 || day1.dataset.num['rank.composite']![k(s)]! > 20).toBe(true);
    expect(newcomers).toContain(ADDED);
  });

  it('risk series and symbol series follow snapshot dates', () => {
    const series = riskSeries(
      [metaOf(snap1)],
      { date: day2.dataset.snapshotDate!, risk: day2.marketRisk },
      'equal',
    );
    expect(series.labels).toEqual(['1405/08/04', '1405/08/05']);
    const s = symbolSeries([snap2, snap1], 'شستا', ['score.technical']);
    expect(s.labels).toEqual(['1405/08/04', '1405/08/05']);
    expect(s.series['score.technical']).toHaveLength(2);
    expect(
      symbolSeries([snap1, snap2], 'ذوب', ['score.technical']).series['score.technical']?.[1],
    ).toBeNull();
  });

  it('JSON export/import round-trips snapshots', () => {
    const back = deserializeSnapshots(serializeSnapshots([snap1]));
    expect(back?.[0]?.key).toBe('1405-08-04');
    expect(back?.[0]?.fields['score.technical']?.[5]).toBe(snap1.fields['score.technical']?.[5]);
    expect(deserializeSnapshots('{"kind":"other"}')).toBeNull();
  });
});

describe('history persistence (IndexedDB)', () => {
  beforeEach(async () => {
    resetDbForTests();
    await historyRepo.remove((await historyRepo.index()).map((m) => m.key));
  });

  it('saves snapshots, keeps the index in sync and enforces retention', async () => {
    const mgr = new HistoryManager();
    await mgr.init();
    await mgr.save(day1.dataset, day1.marketRisk, 1);
    expect(mgr.exists(day1.dataset.snapshotDate)).toBe(true);
    await mgr.save(day2.dataset, day2.marketRisk, 1);
    expect(mgr.list.map((m) => m.key)).toEqual(['1405-08-05']);
    expect(await historyRepo.get('1405-08-04')).toBeUndefined();
  });

  it('prepares the previous record and decorates a dataset', async () => {
    const mgr = new HistoryManager();
    await mgr.init();
    await mgr.save(day1.dataset, day1.marketRisk, 10);
    await mgr.preparePrevious(day2.dataset.snapshotDate);
    const { dataset, diff } = mgr.decorate(day2.dataset);
    expect(diff?.newSymbols).toEqual([ADDED]);
    expect(dataset.num['delta.score.composite']).toBeDefined();
    expect(mgr.riskHistory(day2.dataset.snapshotDate).equal).toHaveLength(1);
  });
});
