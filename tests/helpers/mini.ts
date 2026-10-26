import type { Dataset } from '../../src/core/types';

/** Builds a tiny dataset from plain row objects (numbers or text). */
export function miniDataset(rows: Array<Record<string, number | string | null>>): Dataset {
  const ds: Dataset = {
    snapshotDate: { y: 1405, m: 8, d: 4 },
    fileName: 'test.xlsx',
    size: rows.length,
    symbols: rows.map((r, i) => String(r['Symbol'] ?? `S${i}`)),
    text: {},
    num: {},
    meta: {},
  };
  const keys = new Set(rows.flatMap((r) => Object.keys(r)));
  for (const k of keys) {
    const isText = rows.some((r) => typeof r[k] === 'string');
    if (isText) ds.text[k] = rows.map((r) => String(r[k] ?? ''));
    else
      ds.num[k] = Float64Array.from(
        rows.map((r) => (r[k] === null || r[k] === undefined ? NaN : Number(r[k]))),
      );
    ds.meta[k] = {
      id: k,
      label: k,
      category: 'uncategorized',
      unit: 'number',
      direction: 'neutral',
      source: 'raw',
      kind: isText ? 'text' : 'num',
    };
  }
  return ds;
}
