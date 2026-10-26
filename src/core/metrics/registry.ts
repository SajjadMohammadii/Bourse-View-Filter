import type { Dataset, FieldMeta, Result } from '../types';
import { ok } from '../types';
import { topoSort } from '../utils/graph';
import type { MetricContext, MetricDef, RowAccessor } from './types';

export interface MetricRunReport {
  /** metric id → required inputs that are absent from the dataset. */
  missingInputs: Record<string, string[]>;
  computed: string[];
}

/** Accessor over row `i` of a dataset (mutable index to avoid per-row allocation). */
export function rowAccessor(ds: Dataset): RowAccessor & { i: number } {
  return {
    i: 0,
    get(id) {
      const v = ds.num[id]?.[this.i];
      return v !== undefined && Number.isFinite(v) ? v : null;
    },
    text(id) {
      return ds.text[id]?.[this.i] ?? '';
    },
  };
}

/**
 * Computes metrics in dependency order and returns a new dataset with the extra columns.
 * Inputs are never mutated. Metrics with missing inputs still run (they yield null).
 */
export function computeMetrics(
  input: Dataset,
  defs: readonly MetricDef[],
  ctx: MetricContext,
  source: FieldMeta['source'] = 'derived',
): Result<{ dataset: Dataset; report: MetricRunReport }> {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const order = topoSort([...byId.keys()], (id) => byId.get(id)?.requires ?? []);
  if (!order.ok) return order;

  const ds: Dataset = { ...input, num: { ...input.num }, meta: { ...input.meta } };
  const report: MetricRunReport = { missingInputs: {}, computed: [] };
  const acc = rowAccessor(ds);

  for (const id of order.value) {
    const def = byId.get(id) as MetricDef;
    const missing = def.requires.filter((r) => !(r in ds.num) && !(r in ds.text));
    if (missing.length) report.missingInputs[id] = missing;
    const out = new Float64Array(ds.size);
    for (let i = 0; i < ds.size; i++) {
      acc.i = i;
      const v = def.compute(acc, ctx);
      out[i] = v === null || Number.isNaN(v) ? NaN : v;
    }
    ds.num[id] = out;
    ds.meta[id] = metaOf(def, source);
    report.computed.push(id);
  }
  return ok({ dataset: ds, report });
}

function metaOf(def: MetricDef, source: FieldMeta['source']): FieldMeta {
  return {
    id: def.id,
    label: def.label,
    category: def.category,
    unit: def.unit,
    direction: def.direction,
    horizon: def.horizon,
    description: def.description,
    source,
    kind: 'num',
  };
}
