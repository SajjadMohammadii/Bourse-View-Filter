import { append, h, replace } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page, PageContext } from '../page';
import type { Dataset, Direction, Unit } from '../../core/types';
import type { App } from '../../app/appState';
import {
  computeCustomMetrics,
  normalizeCustomId,
  type CustomMetricDef,
} from '../../core/metrics/customMetrics';
import { summarize } from '../../core/utils/fieldSummary';
import { defaultConstants } from '../../core/filters';
import { createDataPage } from './data-page';
import { card } from './page-helpers';
import { ExpressionEditor } from '../components/expression-editor';
import { miniHistogram } from '../components/mini-histogram';
import { toast } from '../components/toast';
import { downloadText, pickTextFile } from '../../app/services/exportService';
import { profiles } from '../../config/profiles';
import { pct } from '../../config/profiles/builders';
import { fv } from '../format';

const t = fa.custom;
const UNITS: Unit[] = ['ratio', 'percent', 'rial', 'days', 'times', 'number'];
const DIRECTIONS: Array<'higher' | 'lower' | 'neutral'> = ['higher', 'lower', 'neutral'];
const view: { editing: CustomMetricDef | null; originalId: string | null } = {
  editing: null,
  originalId: null,
};

const blank = (): CustomMetricDef => ({
  id: 'C_',
  label: '',
  expression: '',
  unit: 'ratio',
  direction: 'higher',
});

/** Custom metrics (PLAN.md §11.5, §12.3-و). */
export function createCustomMetricsPage(ctx: PageContext): Page {
  return createDataPage(ctx, t.title, (body, ds, state) => {
    const app = ctx.app;
    append(body, [
      h(
        'div',
        { class: 'page-head' },
        h('h1', { class: 'grow', text: t.title }),
        h('button', {
          class: 'btn primary',
          text: `+ ${t.new}`,
          on: {
            click: () => {
              view.editing = blank();
              view.originalId = null;
              app.requestRender();
            },
          },
        }),
        h('button', {
          class: 'btn',
          text: fa.studio.export,
          on: { click: () => downloadText(app.library.exportMetrics(), 'bourse-view-custom-metrics.json') },
        }),
        h('button', { class: 'btn', text: fa.studio.import, on: { click: () => void importMetrics(app) } }),
      ),
      h(
        'div',
        { class: 'grid grid-2' },
        listCard(app, ds, state.customMetrics, state.customErrors),
        view.editing ? editorCard(app, ds, view.editing) : null,
      ),
    ]);
  });
}

async function importMetrics(app: App): Promise<void> {
  const text = await pickTextFile();
  if (!text) return;
  const r = await app.library.importMetrics(text);
  toast(r.ok ? fa.studio.imported(r.value) : r.error.message, r.ok ? 'ok' : 'error');
}

function listCard(
  app: App,
  ds: Dataset,
  metrics: CustomMetricDef[],
  errors: Record<string, string>,
): HTMLElement {
  if (!metrics.length) return card(t.list, h('p', { class: 'muted', text: t.none }));
  return card(
    t.list,
    h(
      'table',
      { class: 'simple-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          [t.id, t.label, t.expression, t.coverage, ''].map((x) => h('th', { text: x })),
        ),
      ),
      h(
        'tbody',
        {},
        metrics.map((m) => {
          const col = ds.num[m.id];
          const cov = col ? summarize(col).coverage : NaN;
          return h(
            'tr',
            {},
            h('td', {}, h('code', { text: m.id })),
            h('td', { text: m.label }),
            h(
              'td',
              {},
              h('code', { text: m.expression }),
              errors[m.id] ? h('div', { class: 'neg', text: errors[m.id] }) : null,
              factorUses(app, m.id),
            ),
            h('td', {}, h('bdi', { class: 'num', text: fv(cov, 'percent') })),
            h(
              'td',
              { style: 'white-space:nowrap' },
              h('button', {
                class: 'btn sm',
                text: t.edit,
                on: {
                  click: () => {
                    view.editing = { ...m };
                    view.originalId = m.id;
                    app.requestRender();
                  },
                },
              }),
              h('button', {
                class: 'btn sm ghost',
                text: t.delete,
                on: {
                  click: () => {
                    if (window.confirm(t.confirmDelete)) void app.library.deleteMetric(m.id);
                  },
                },
              }),
            ),
          );
        }),
      ),
    ),
  );
}

/** Lists the factors that use this metric, each removable. */
function factorUses(app: App, id: string): HTMLElement | null {
  const edits = app.store.get().settings.scoring.profileEdits ?? {};
  const uses: Array<[string, string]> = [];
  for (const [pid, factors] of Object.entries(edits)) {
    for (const [fid, e] of Object.entries(factors))
      if (e.added?.some((m) => m.metric === id)) uses.push([pid, fid]);
  }
  if (!uses.length) return null;
  return h(
    'div',
    { class: 'row', style: 'margin-top:4px' },
    h('span', { class: 'faint', text: `${t.inFactors}:` }),
    uses.map(([pid, fid]) =>
      h('button', {
        class: 'chip',
        attrs: { title: t.removeFromFactor },
        text: `${profiles.find((p) => p.id === pid)?.label ?? pid} · ${fid} ✕`,
        on: { click: () => app.removeMetricFromFactor(pid, fid, id) },
      }),
    ),
  );
}

function editorCard(app: App, ds: Dataset, def: CustomMetricDef): HTMLElement {
  const preview = h('div', { class: 'stack' });
  const idInput = h('input', {
    class: 'input mono',
    attrs: { value: def.id, 'aria-label': t.id, dir: 'ltr' },
  });
  const labelInput = h('input', { class: 'input', attrs: { value: def.label, 'aria-label': t.label } });
  const unit = select(
    UNITS.map((u) => [u, t.units[u] ?? u]),
    def.unit,
    t.unit,
  );
  const direction = select(
    DIRECTIONS.map((d) => [d, t[d]]),
    def.direction,
    t.direction,
  );
  const catalog = app.catalog();
  const current = (): CustomMetricDef => ({
    ...def,
    id: normalizeCustomId(idInput.value),
    label: labelInput.value.trim() || normalizeCustomId(idInput.value),
    expression: editor.value,
    unit: unit.value as Unit,
    direction: direction.value as Direction,
  });
  const editor = new ExpressionEditor({
    value: def.expression,
    placeholder: 'NI_MRQ / NI_FY',
    catalog: catalog ?? { fields: new Map(), constants: new Map() },
    label: (id) => ds.meta[id]?.label,
    compile: (text) => app.compile(text) ?? { ok: false, error: { code: 'NO_DATA', message: t.needData } },
    onChange: () => drawPreview(app, ds, current(), preview),
    rows: 2,
  });
  drawPreview(app, ds, current(), preview);
  const save = h('button', {
    class: 'btn primary',
    text: t.save,
    on: {
      click: () => {
        const d = current();
        if (!d.expression.trim()) return;
        void app.library.saveMetric(d, view.originalId ?? undefined).then((saved) => {
          view.editing = saved;
          view.originalId = saved.id;
          toast(t.saved, 'ok');
        });
      },
    },
  });
  const cancel = h('button', {
    class: 'btn',
    text: t.cancel,
    on: {
      click: () => {
        view.editing = null;
        app.requestRender();
      },
    },
  });
  return card(
    view.originalId ? `${t.edit}: ${view.originalId}` : t.new,
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:1fr 1fr;gap:8px' },
      field(t.id, idInput),
      field(t.label, labelInput),
      field(t.unit, unit),
      field(t.direction, direction),
    ),
    field(t.expression, editor.el),
    h('div', { class: 'row' }, save, cancel),
    preview,
    view.originalId ? addToFactor(app, view.originalId, def.direction) : null,
  );
}

function drawPreview(app: App, ds: Dataset, def: CustomMetricDef, host: HTMLElement): void {
  const others = app.store.get().customMetrics.filter((m) => m.id !== def.id && m.id !== view.originalId);
  const a = app.store.get().settings.assumptions;
  const run = computeCustomMetrics(ds, [...others, def], {
    inflation: a.inflation,
    constants: defaultConstants(a.inflation, a.riskFreeRate),
  });
  const err = run.errors[def.id];
  const col = run.dataset.num[def.id];
  if (!def.expression.trim()) return replace(host);
  if (err || !col) return replace(host, h('div', { class: 'error-box', text: `${t.error}: ${err ?? ''}` }));
  const symbolInput = h('input', {
    class: 'input',
    attrs: { list: 'bv-symbols', placeholder: t.testSymbol, 'aria-label': t.testSymbol },
  });
  const out = h('bdi', { class: 'num' });
  symbolInput.addEventListener('change', () => {
    const i = ds.symbols.indexOf(symbolInput.value.trim());
    out.textContent = i >= 0 ? fv(col[i], def.unit) : fa.stock.notFound;
  });
  replace(
    host,
    h('h3', { text: t.preview }),
    miniHistogram(summarize(col), def.unit),
    h('div', { class: 'row' }, symbolInput, h('span', { class: 'muted', text: `${t.value}:` }), out),
  );
}

function addToFactor(app: App, metric: string, direction: Direction): HTMLElement {
  const profileSel = select(
    profiles.map((p) => [p.id, p.label]),
    'fundamentalQuarterly',
    t.profile,
  );
  const factorSel = h('select', { class: 'select', attrs: { 'aria-label': t.factor } });
  const fillFactors = () =>
    replace(
      factorSel,
      (profiles.find((p) => p.id === profileSel.value)?.factors ?? []).map((f) =>
        h('option', { attrs: { value: f.id }, text: `${f.id} ${f.label}` }),
      ),
    );
  profileSel.addEventListener('change', fillFactors);
  fillFactors();
  const dirSel = select(
    [
      ['higher', t.higher],
      ['lower', t.lower],
    ],
    direction === 'lower' ? 'lower' : 'higher',
    t.direction,
  );
  const weight = h('input', {
    class: 'input num',
    style: 'width:80px',
    attrs: { type: 'number', min: 0.1, step: 0.5, value: 1, 'aria-label': t.weight },
  });
  const add = h('button', {
    class: 'btn primary',
    text: t.add,
    on: {
      click: () => {
        app.addMetricToFactor(
          profileSel.value,
          factorSel.value,
          pct(metric, dirSel.value as 'higher' | 'lower', Number(weight.value) || 1),
        );
        toast(t.added, 'ok');
      },
    },
  });
  return h(
    'div',
    { class: 'stack', style: 'gap:6px' },
    h('h3', { text: t.addToFactor }),
    h(
      'div',
      { class: 'row' },
      profileSel,
      factorSel,
      dirSel,
      h('span', { class: 'muted', text: t.weight }),
      weight,
      add,
    ),
  );
}

function select(options: Array<[string, string]>, value: string, label: string): HTMLSelectElement {
  return h(
    'select',
    { class: 'select', attrs: { 'aria-label': label } },
    options.map(([v, l]) => h('option', { attrs: { value: v, selected: v === value }, text: l })),
  );
}

function field(label: string, control: HTMLElement): HTMLElement {
  return h('label', { class: 'field' }, h('span', { text: label }), control);
}
