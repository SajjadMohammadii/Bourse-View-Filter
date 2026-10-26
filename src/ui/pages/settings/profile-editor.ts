import { h } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { App } from '../../../app/appState';
import type { FactorMetric, ProfileDef } from '../../../core/scoring/types';
import { applyProfileEdits } from '../../../core/scoring/customizeProfiles';
import { replaceFactorMetric, resetProfile } from '../../../app/settingsActions';
import { columnDefs } from '../../../config/columns';
import { derivedMetrics } from '../../../config/derivedMetrics';
import { pct } from '../../../config/profiles/builders';

const t = fa.settings;

/** Metric ids offered when adding to a factor: numeric raw columns, derived and custom metrics. */
function metricOptions(app: App): Array<[string, string]> {
  const custom = app.store.get().customMetrics.map((m): [string, string] => [m.id, `${m.label} — ${m.id}`]);
  const derived = derivedMetrics.map((m): [string, string] => [m.id, `${m.label} — ${m.id}`]);
  const raw = columnDefs
    .filter((c) => c.kind !== 'text')
    .map((c): [string, string] => [c.id, `${c.label} — ${c.id}`]);
  return [...custom, ...derived, ...raw];
}

function normalizerText(m: FactorMetric): string {
  const n = m.normalizer;
  if (n.kind === 'percentile') return n.direction === 'higher' ? t.higher : t.lower;
  if (n.kind === 'band') return `باند ${n.ideal[0]}…${n.ideal[1]}`;
  if (n.kind === 'linear') return `خطی ${n.min}…${n.max}`;
  return 'بولی';
}

/** Advanced editor: per factor metric weights/directions, remove/restore, add (PLAN.md §12.3-ح). */
export function profileEditor(app: App, base: ProfileDef): HTMLElement {
  const edits = app.store.get().settings.scoring.profileEdits ?? {};
  const effective = applyProfileEdits([base], edits)[0] as ProfileDef;
  const options = metricOptions(app);
  return h(
    'details',
    { class: 'card' },
    // Interactive controls may not live inside <summary> (nested-interactive).
    h('summary', { style: 'cursor:pointer' }, h('b', { text: base.label })),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn sm', text: t.resetProfile, on: { click: () => resetProfile(app, base.id) } }),
    ),
    base.factors.map((bf) => {
      const f = effective.factors.find((x) => x.id === bf.id) ?? bf;
      const removed = edits[base.id]?.[bf.id]?.removed ?? [];
      const baseIds = new Set(bf.metrics.map((m) => m.metric));
      const rows = f.metrics.map((m) => metricRow(app, base.id, bf.id, m, baseIds.has(m.metric)));
      const removedRows = bf.metrics
        .filter((m) => removed.includes(m.metric) && !f.metrics.some((x) => x.metric === m.metric))
        .map((m) => removedRow(app, base.id, bf.id, m));
      return h(
        'div',
        { class: 'factor-edit' },
        h('h3', { text: `${bf.id} ${bf.label}` }),
        h('table', { class: 'simple-table' }, h('tbody', {}, rows, removedRows)),
        addRow(app, base.id, bf.id, options),
      );
    }),
  );
}

function metricRow(
  app: App,
  profileId: string,
  factorId: string,
  m: FactorMetric,
  isBase: boolean,
): HTMLElement {
  const weight = h('input', {
    class: 'input num',
    style: 'width:70px',
    attrs: { type: 'number', min: 0, step: 0.5, value: String(m.weight), 'aria-label': t.metricWeight },
  });
  weight.addEventListener('change', () =>
    replaceFactorMetric(
      app,
      profileId,
      factorId,
      { ...m, weight: Math.max(0, Number(weight.value) || 0) },
      isBase,
    ),
  );
  const dir =
    m.normalizer.kind === 'percentile'
      ? (() => {
          const sel = h(
            'select',
            { class: 'select', attrs: { 'aria-label': t.metricDirection } },
            (['higher', 'lower'] as const).map((d) =>
              h('option', {
                attrs: {
                  value: d,
                  selected: m.normalizer.kind === 'percentile' && m.normalizer.direction === d,
                },
                text: t[d],
              }),
            ),
          );
          sel.addEventListener('change', () =>
            replaceFactorMetric(
              app,
              profileId,
              factorId,
              { ...m, normalizer: { kind: 'percentile', direction: sel.value as 'higher' | 'lower' } },
              isBase,
            ),
          );
          return sel;
        })()
      : h('span', { class: 'muted', text: normalizerText(m) });
  const remove = h('button', {
    class: 'btn sm ghost',
    text: t.removeMetric,
    on: { click: () => app.removeMetricFromFactor(profileId, factorId, m.metric) },
  });
  return h(
    'tr',
    {},
    h(
      'td',
      {},
      h('code', { text: m.metric }),
      isBase ? null : h('span', { class: 'badge flag-chip good', text: t.custom }),
    ),
    h('td', {}, weight),
    h('td', {}, dir),
    h('td', {}, remove),
  );
}

function removedRow(app: App, profileId: string, factorId: string, m: FactorMetric): HTMLElement {
  return h(
    'tr',
    { class: 'disabled' },
    h('td', {}, h('code', { text: m.metric }), h('span', { class: 'badge flag-chip bad', text: t.removed })),
    h('td', {}),
    h('td', {}),
    h(
      'td',
      {},
      h('button', {
        class: 'btn sm',
        text: t.restoreMetric,
        on: { click: () => app.addMetricToFactor(profileId, factorId, m) },
      }),
    ),
  );
}

function addRow(
  app: App,
  profileId: string,
  factorId: string,
  options: Array<[string, string]>,
): HTMLElement {
  const listId = `bv-metrics-${profileId}-${factorId}`;
  const input = h('input', {
    class: 'input mono',
    attrs: { list: listId, placeholder: t.addMetric, 'aria-label': t.addMetric, dir: 'ltr' },
    style: 'min-width:260px',
  });
  const datalist = h(
    'datalist',
    { attrs: { id: listId } },
    options.map(([id, label]) => h('option', { attrs: { value: id }, text: label })),
  );
  input.addEventListener('change', () => {
    const id = input.value.trim();
    if (options.some(([o]) => o === id)) app.addMetricToFactor(profileId, factorId, pct(id));
    input.value = '';
  });
  return h('div', { class: 'row' }, input, datalist);
}
