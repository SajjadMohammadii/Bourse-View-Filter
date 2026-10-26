import type { SnapshotMeta, SnapshotRecord } from '../../core/history/snapshot';
import { metaOf } from '../../core/history/snapshot';
import { db, safe } from './db';

const INDEX_KEY = 'historyIndex';

/** Snapshot history in IndexedDB: full records + a light index for fast listing. */
export const historyRepo = {
  index: () =>
    safe(
      async () => ((await (await db()).get('kv', INDEX_KEY)) as SnapshotMeta[] | undefined) ?? [],
      [] as SnapshotMeta[],
    ),
  get: (key: string) =>
    safe(async () => (await (await db()).get('snapshots', key)) as SnapshotRecord | undefined, undefined),
  all: () =>
    safe(async () => (await (await db()).getAll('snapshots')) as SnapshotRecord[], [] as SnapshotRecord[]),

  async put(record: SnapshotRecord): Promise<SnapshotMeta[]> {
    return safe(async () => {
      const d = await db();
      const tx = d.transaction(['snapshots', 'kv'], 'readwrite');
      await tx.objectStore('snapshots').put(record);
      const index = (
        ((await tx.objectStore('kv').get(INDEX_KEY)) as SnapshotMeta[] | undefined) ?? []
      ).filter((m) => m.key !== record.key);
      index.push(metaOf(record));
      await tx.objectStore('kv').put(index, INDEX_KEY);
      await tx.done;
      return index;
    }, []);
  },

  async remove(keys: string[]): Promise<SnapshotMeta[]> {
    return safe(async () => {
      const d = await db();
      const tx = d.transaction(['snapshots', 'kv'], 'readwrite');
      for (const k of keys) await tx.objectStore('snapshots').delete(k);
      const index = (
        ((await tx.objectStore('kv').get(INDEX_KEY)) as SnapshotMeta[] | undefined) ?? []
      ).filter((m) => !keys.includes(m.key));
      await tx.objectStore('kv').put(index, INDEX_KEY);
      await tx.done;
      return index;
    }, []);
  },
};

/** JSON-safe form: typed arrays become plain arrays (NaN → null). */
export function serializeSnapshots(records: SnapshotRecord[]): string {
  const plain = records.map((r) => ({
    ...r,
    fields: Object.fromEntries(
      Object.entries(r.fields).map(([k, v]) => [k, Array.from(v, (x) => (Number.isFinite(x) ? x : null))]),
    ),
  }));
  return JSON.stringify({ app: 'bourse-view-filters', kind: 'history', version: 1, items: plain });
}

export function deserializeSnapshots(text: string): SnapshotRecord[] | null {
  try {
    const data = JSON.parse(text) as {
      kind?: string;
      items?: Array<Omit<SnapshotRecord, 'fields'> & { fields: Record<string, Array<number | null>> }>;
    };
    if (data.kind !== 'history' || !Array.isArray(data.items)) return null;
    return data.items.map((r) => ({
      ...r,
      fields: Object.fromEntries(
        Object.entries(r.fields).map(([k, v]) => [k, Float32Array.from(v, (x) => (x === null ? NaN : x))]),
      ),
    }));
  } catch {
    return null;
  }
}
