import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/** Single IndexedDB database for everything persisted locally (PLAN.md §2, §13). */
interface Schema extends DBSchema {
  kv: { key: string; value: unknown };
  presets: { key: string; value: { id: string; label: string; expression: string; description?: string } };
  customMetrics: { key: string; value: unknown };
  snapshots: { key: string; value: unknown };
}

const DB_NAME = 'bourse-view-filters';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('presets', { keyPath: 'id' });
      d.createObjectStore('customMetrics', { keyPath: 'id' });
      d.createObjectStore('snapshots', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

/** Runs a storage call; storage failures (private mode, quota) never break the app. */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Test hook: forget the cached connection. */
export function resetDbForTests(): void {
  dbPromise = null;
}
