import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import { normalizeCustomId, type CustomMetricDef } from '../core/metrics/customMetrics';
import { filterPresets, type FilterPreset } from '../config/filterPresets';
import { customMetricsRepo, fromJson, presetsRepo, toJson } from './persistence/repos';
import type { App } from './appState';

const METRICS_KIND = 'customMetrics';
const PRESETS_KIND = 'filterPresets';

/** User library: custom metrics and saved filter presets, persisted in IndexedDB. */
export class Library {
  constructor(private readonly app: App) {}

  async init(): Promise<void> {
    const [customMetrics, userPresets] = await Promise.all([customMetricsRepo.all(), presetsRepo.all()]);
    this.app.store.set({ customMetrics, userPresets });
  }

  // ───────── custom metrics ─────────

  /** Adds or replaces a metric (id gets the C_ prefix) and rescores. */
  async saveMetric(def: CustomMetricDef, previousId?: string): Promise<CustomMetricDef> {
    const clean = { ...def, id: normalizeCustomId(def.id) };
    const list = this.app.store.get().customMetrics.filter((m) => m.id !== clean.id && m.id !== previousId);
    if (previousId && previousId !== clean.id) await customMetricsRepo.remove(previousId);
    await customMetricsRepo.put(clean);
    this.app.store.set({ customMetrics: [...list, clean] });
    this.app.scheduleRescore();
    return clean;
  }

  async deleteMetric(id: string): Promise<void> {
    await customMetricsRepo.remove(id);
    this.app.store.set({ customMetrics: this.app.store.get().customMetrics.filter((m) => m.id !== id) });
    this.app.scheduleRescore();
  }

  exportMetrics(): string {
    return toJson(METRICS_KIND, this.app.store.get().customMetrics);
  }

  async importMetrics(text: string): Promise<Result<number>> {
    const items = fromJson<CustomMetricDef>(METRICS_KIND, text);
    if (!items) return err('BAD_FILE', 'فایل JSON پارامترهای سفارشی معتبر نیست.');
    const valid = items.filter((m) => typeof m?.id === 'string' && typeof m.expression === 'string');
    for (const m of valid)
      await this.saveMetric({
        ...m,
        label: m.label ?? m.id,
        unit: m.unit ?? 'number',
        direction: m.direction ?? 'higher',
      });
    return ok(valid.length);
  }

  // ───────── filter presets ─────────

  /** Built-in presets followed by the user's own. */
  presets(): FilterPreset[] {
    return [...filterPresets, ...this.app.store.get().userPresets];
  }

  async savePreset(p: Omit<FilterPreset, 'id' | 'builtIn'> & { id?: string }): Promise<FilterPreset> {
    const preset: FilterPreset = {
      id: p.id && !filterPresets.some((b) => b.id === p.id) ? p.id : `u${Date.now().toString(36)}`,
      label: p.label,
      expression: p.expression,
      description: p.description,
    };
    await presetsRepo.put(preset);
    this.app.store.set({
      userPresets: [...this.app.store.get().userPresets.filter((x) => x.id !== preset.id), preset],
    });
    return preset;
  }

  async deletePreset(id: string): Promise<void> {
    await presetsRepo.remove(id);
    this.app.store.set({ userPresets: this.app.store.get().userPresets.filter((p) => p.id !== id) });
  }

  exportPresets(): string {
    return toJson(PRESETS_KIND, this.app.store.get().userPresets);
  }

  async importPresets(text: string): Promise<Result<number>> {
    const items = fromJson<FilterPreset>(PRESETS_KIND, text);
    if (!items) return err('BAD_FILE', 'فایل JSON پریست‌های فیلتر معتبر نیست.');
    const valid = items.filter((p) => typeof p?.label === 'string' && typeof p.expression === 'string');
    for (const p of valid)
      await this.savePreset({ label: p.label, expression: p.expression, description: p.description });
    return ok(valid.length);
  }
}
