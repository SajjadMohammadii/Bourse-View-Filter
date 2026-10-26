import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import type { FactorMetric } from '../core/scoring/types';
import type { CustomMetricDef } from '../core/metrics/customMetrics';
import type { FilterPreset } from '../config/filterPresets';
import type { App } from './appState';
import { mergeSettings, type AppSettings } from './settings';
import { db } from './persistence/db';
import { historyRepo } from './persistence/historyRepo';

/** Settings-page use cases (PLAN.md §12.3-ح), kept out of the App facade to keep it small. */

type Edits = NonNullable<AppSettings['scoring']['profileEdits']>;

function editsOf(app: App): Edits {
  return structuredClone(app.store.get().settings.scoring.profileEdits ?? {});
}

function saveEdits(app: App, edits: Edits): void {
  const scoring = app.store.get().settings.scoring;
  app.updateSettings({ scoring: { ...scoring, profileEdits: edits } });
}

/** Replaces a factor metric's spec (weight/direction). Base metrics are overridden via remove+add. */
export function replaceFactorMetric(
  app: App,
  profileId: string,
  factorId: string,
  metric: FactorMetric,
  isBase: boolean,
): void {
  const edits = editsOf(app);
  const fe = ((edits[profileId] ??= {})[factorId] ??= {});
  fe.added = [...(fe.added ?? []).filter((m) => m.metric !== metric.metric), metric];
  if (isBase) fe.removed = [...new Set([...(fe.removed ?? []), metric.metric])];
  saveEdits(app, edits);
}

/** Restores a profile's factors, weights and preset to the defaults. */
export function resetProfile(app: App, profileId: string): void {
  const s = app.store.get().settings;
  const edits = { ...(s.scoring.profileEdits ?? {}) };
  delete edits[profileId];
  const weights = { ...(s.scoring.factorWeights ?? {}) };
  delete weights[profileId];
  const presets = { ...s.presetByProfile };
  delete presets[profileId];
  app.updateSettings({
    scoring: { ...s.scoring, profileEdits: edits, factorWeights: weights },
    presetByProfile: presets,
  });
}

interface Bundle {
  app: 'bourse-view-filters';
  kind: 'bundle';
  version: 1;
  settings: AppSettings;
  customMetrics: CustomMetricDef[];
  presets: FilterPreset[];
}

/** Settings + custom metrics + user presets in one JSON backup. */
export function exportBundle(app: App): string {
  const s = app.store.get();
  const bundle: Bundle = {
    app: 'bourse-view-filters',
    kind: 'bundle',
    version: 1,
    settings: s.settings,
    customMetrics: s.customMetrics,
    presets: s.userPresets,
  };
  return JSON.stringify(bundle, null, 2);
}

export async function importBundle(app: App, text: string): Promise<Result<void>> {
  let data: Partial<Bundle>;
  try {
    data = JSON.parse(text) as Partial<Bundle>;
  } catch {
    return err('BAD_FILE', 'فایل پشتیبان معتبر نیست.');
  }
  if (data.kind !== 'bundle') return err('BAD_FILE', 'این فایل پشتیبان تنظیمات نیست.');
  for (const m of data.customMetrics ?? []) await app.library.saveMetric(m);
  for (const p of data.presets ?? []) await app.library.savePreset(p);
  app.updateSettings(mergeSettings(data.settings));
  return ok(undefined);
}

export async function deleteSnapshot(app: App, key: string): Promise<void> {
  app.store.set({ history: await historyRepo.remove([key]) });
  await app.history.init();
}

export async function clearHistory(app: App): Promise<void> {
  await app.history.clear();
  app.store.set({ history: [] });
}

export async function importHistory(app: App, text: string): Promise<Result<number>> {
  const n = await app.history.importAll(text);
  if (n === null) return err('BAD_FILE', 'فایل تاریخچه معتبر نیست.');
  app.store.set({ history: app.history.list });
  return ok(n);
}

/** Deletes every locally stored item (settings, history, presets, custom metrics, last file). */
export async function clearAllData(): Promise<void> {
  const d = await db();
  for (const store of ['kv', 'presets', 'customMetrics', 'snapshots'] as const) await d.clear(store);
}
