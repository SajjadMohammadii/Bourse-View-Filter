import type { FactorMetric, ProfileDef } from './types';

/** User edits to a factor: metrics added (e.g. custom metrics) or removed (PLAN.md §11.5, §12.3-ح). */
export interface FactorEdit {
  added?: FactorMetric[];
  removed?: string[];
}

/** profileId → factorId → edit */
export type ProfileEdits = Record<string, Record<string, FactorEdit>>;

/** Returns profiles with user edits applied; untouched profiles are returned as-is. */
export function applyProfileEdits(
  profiles: readonly ProfileDef[],
  edits: ProfileEdits | undefined,
): ProfileDef[] {
  if (!edits) return [...profiles];
  return profiles.map((p) => {
    const pe = edits[p.id];
    if (!pe) return p;
    return {
      ...p,
      factors: p.factors.map((f) => {
        const fe = pe[f.id];
        if (!fe) return f;
        const removed = new Set(fe.removed ?? []);
        const kept = f.metrics.filter((m) => !removed.has(m.metric));
        const added = (fe.added ?? []).filter((m) => !kept.some((k) => k.metric === m.metric));
        return { ...f, metrics: [...kept, ...added] };
      }),
    };
  });
}
