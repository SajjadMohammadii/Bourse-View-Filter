import type { CustomMetricDef } from '../../core/metrics/customMetrics';
import type { FilterPreset } from '../../config/filterPresets';
import { db, safe } from './db';

/** User-defined custom metrics (PLAN.md §11.5). */
export const customMetricsRepo = {
  all: () =>
    safe(
      async () => (await (await db()).getAll('customMetrics')) as CustomMetricDef[],
      [] as CustomMetricDef[],
    ),
  put: (d: CustomMetricDef) => safe(async () => void (await (await db()).put('customMetrics', d)), undefined),
  remove: (id: string) => safe(async () => void (await (await db()).delete('customMetrics', id)), undefined),
};

/** User filter presets; built-ins live in config and are never stored (PLAN.md §11.7). */
export const presetsRepo = {
  all: () => safe(async () => (await (await db()).getAll('presets')) as FilterPreset[], [] as FilterPreset[]),
  put: (p: FilterPreset) =>
    safe(
      async () =>
        void (await (
          await db()
        ).put('presets', { id: p.id, label: p.label, expression: p.expression, description: p.description })),
      undefined,
    ),
  remove: (id: string) => safe(async () => void (await (await db()).delete('presets', id)), undefined),
};

export interface StoredFile {
  name: string;
  buffer: ArrayBuffer;
}

/** The last loaded Excel file, so a refresh restores the session without re-uploading. */
export const lastFileRepo = {
  get: () =>
    safe(async () => (await (await db()).get('kv', 'lastFile')) as StoredFile | undefined, undefined),
  put: (f: StoredFile) => safe(async () => void (await (await db()).put('kv', f, 'lastFile')), undefined),
};

/** JSON export/import envelope with a kind tag so files are not mixed up. */
export function toJson(kind: string, items: unknown[]): string {
  return JSON.stringify({ app: 'bourse-view-filters', kind, version: 1, items }, null, 2);
}

export function fromJson<T>(kind: string, text: string): T[] | null {
  try {
    const data = JSON.parse(text) as { kind?: string; items?: unknown };
    return data.kind === kind && Array.isArray(data.items) ? (data.items as T[]) : null;
  } catch {
    return null;
  }
}
