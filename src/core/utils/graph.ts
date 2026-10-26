import type { Result } from '../types';
import { err, ok } from '../types';

/**
 * Topological order of nodes; `deps(id)` lists the node ids that `id` depends on.
 * Dependencies that are not nodes (e.g. raw columns) are ignored.
 * On a cycle returns an error whose details are the cycle path (a → b → a).
 */
export function topoSort(ids: string[], deps: (id: string) => string[]): Result<string[]> {
  const nodes = new Set(ids);
  const state = new Map<string, 'visiting' | 'done'>();
  const order: string[] = [];
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const s = state.get(id);
    if (s === 'done') return null;
    if (s === 'visiting') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'visiting');
    stack.push(id);
    for (const d of deps(id)) {
      if (!nodes.has(d)) continue;
      const cycle = visit(d);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, 'done');
    order.push(id);
    return null;
  };

  for (const id of ids) {
    const cycle = visit(id);
    if (cycle) return err('CYCLE', `وابستگی چرخه‌ای: ${cycle.join(' → ')}`, cycle);
  }
  return ok(order);
}
