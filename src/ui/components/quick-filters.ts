import { h } from '../dom';
import { fa } from '../../i18n/fa';
import type { App } from '../../app/appState';
import { emptyQuickFilters, type QuickFilters } from '../../app/filterState';
import { exchangeLabels } from '../../config/columns';
import { RIAL_PER_BILLION_TOMAN, RIAL_PER_HEMAT } from '../../core/utils/format';
import { multiSelect, type MultiOption } from './multi-select';
import { fv } from '../format';

/** Quick filter chips (PLAN.md §11.6) bound to the app's global filter state. */
export function quickFilterBar(app: App): { el: HTMLElement; destroy: () => void } {
  const el = h('div', { class: 'quick-bar card', attrs: { role: 'group', 'aria-label': fa.filter.global } });
  const counter = h('span', { class: 'muted num quick-count' });
  const render = () => {
    const { dataset, quick } = app.store.get();
    el.replaceChildren();
    if (!dataset) return;
    const set = (patch: Partial<QuickFilters>) => app.setQuickFilters({ ...app.store.get().quick, ...patch });
    el.append(
      multiSelect(
        fa.quick.exchange,
        options(dataset.text['Exchange'] ?? [], (v) => exchangeLabels[v] ?? v),
        quick.exchanges,
        (v) => set({ exchanges: v }),
      ),
      multiSelect(fa.quick.sector, options(dataset.text['Sector'] ?? []), quick.sectors, (v) =>
        set({ sectors: v }),
      ),
      multiSelect(fa.quick.industry, options(dataset.text['Industry'] ?? []), quick.industries, (v) =>
        set({ industries: v }),
      ),
      numberInput(fa.quick.minMcap, quick.minMarketCap, RIAL_PER_HEMAT, (v) => set({ minMarketCap: v })),
      numberInput(fa.quick.minValue, quick.minAvgValue, RIAL_PER_BILLION_TOMAN, (v) =>
        set({ minAvgValue: v }),
      ),
      numberInput(fa.quick.minConf, quick.minConfidence, 0.01, (v) => set({ minConfidence: v })),
      h('button', {
        class: 'btn sm ghost',
        text: fa.quick.reset,
        on: { click: () => app.setQuickFilters(emptyQuickFilters) },
      }),
      h('span', { class: 'grow' }),
      counter,
    );
    updateCount();
  };
  const updateCount = () => {
    const { dataset, visible } = app.store.get();
    if (dataset) counter.textContent = fa.filter.count(fv(visible.length, 'rank'), fv(dataset.size, 'rank'));
  };
  render();
  const unsub = app.store.subscribe((s, prev) => {
    if (s.dataset?.fileName !== prev.dataset?.fileName || s.quick !== prev.quick) render();
    else if (s.visible !== prev.visible) updateCount();
  });
  return { el, destroy: unsub };
}

function options(values: string[], label: (v: string) => string = (v) => v): MultiOption[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: label(value), count }));
}

/** Numeric input in display units; `scale` converts to stored units (e.g. همت → rial). */
function numberInput(
  label: string,
  value: number | null,
  scale: number,
  onChange: (v: number | null) => void,
): HTMLElement {
  const input = h('input', {
    class: 'input num-in num',
    attrs: {
      type: 'number',
      min: 0,
      step: 'any',
      placeholder: label,
      title: label,
      'aria-label': label,
      value: value === null ? '' : String(value / scale),
    },
  });
  input.addEventListener('change', () => {
    const v = input.value.trim() === '' ? null : Number(input.value);
    onChange(v === null || !Number.isFinite(v) ? null : v * scale);
  });
  return input;
}
