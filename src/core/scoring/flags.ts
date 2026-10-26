import type { Dataset } from '../types';
import type { FlagContext, FlagDef } from './types';
import { rowAccessor } from '../metrics/registry';

/** Evaluates flag definitions into `flag.<id>` columns: 1 = on, 0 = off, NaN = unknown. */
export function computeFlags(
  ds: Dataset,
  defs: readonly FlagDef[],
  ctx: FlagContext,
): Record<string, Float64Array> {
  const out: Record<string, Float64Array> = {};
  const acc = rowAccessor(ds);
  for (const def of defs) {
    const col = new Float64Array(ds.size);
    for (let i = 0; i < ds.size; i++) {
      acc.i = i;
      const v = def.test(acc, ctx);
      col[i] = v === null ? NaN : v ? 1 : 0;
    }
    out[def.id] = col;
  }
  return out;
}
