import { append, h, replace } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page, PageContext } from '../page';
import type { App } from '../../app/appState';
import { emptyGroup, fromAst, toExpression, type BuilderGroup } from '../../core/filters/builderModel';
import { runFilter } from '../../core/filters';
import { createDataPage } from './data-page';
import { card } from './page-helpers';
import { FilterBuilder } from '../components/filter-builder';
import { ExpressionEditor } from '../components/expression-editor';
import { DataTable, columnFromMeta, datasetRows } from '../components/data-table';
import { toast } from '../components/toast';
import { exportRows, downloadText, pickTextFile } from '../../app/services/exportService';
import { profiles } from '../../config/profiles';
import { fv } from '../format';

const t = fa.studio;
const state: { text: string; tree: BuilderGroup } = { text: '', tree: emptyGroup() };
const BASE_FIELDS = [
  'Symbol',
  'Company',
  'Industry',
  'score.composite',
  ...profiles.map((p) => `score.${p.id}`),
];

/** Filter Studio (PLAN.md §12.3-ه): visual builder ↔ text, live preview, presets, export. */
export function createFilterStudioPage(ctx: PageContext): Page {
  return createDataPage(
    ctx,
    t.title,
    (body, ds, appState) => {
      const app = ctx.app;
      const catalog = app.catalog();
      if (!catalog) return;
      const results = h('div');
      const counter = h('span', { class: 'muted num' });
      const banner = h('div');
      let table: DataTable | null = null;

      const preview = () => {
        const c = state.text.trim() ? app.compile(state.text) : null;
        const ctxEval = app.evalContext();
        let idx = appState.visible;
        if (c?.ok && ctxEval) {
          const mask = runFilter(c.value, ctxEval);
          idx = idx.filter((i) => mask[i]);
        }
        const extra = c?.ok ? [...c.value.fields].filter((f) => !BASE_FIELDS.includes(f)).slice(0, 8) : [];
        const fields = [...BASE_FIELDS, ...extra].filter((f) => ds.meta[f]);
        counter.textContent = fa.filter.count(fv(idx.length, 'rank'), fv(appState.visible.length, 'rank'));
        table?.destroy();
        table = new DataTable(results, {
          columns: fields.map((f) => columnFromMeta(ds, f)),
          rows: datasetRows(ds, fields, idx),
          height: '460px',
          initialSort: { column: 'score.composite', dir: 'desc' },
          onRowClick: (r) => app.select(String(r['Symbol'] ?? '')),
        });
        return { idx, fields };
      };

      const editor = new ExpressionEditor({
        value: state.text,
        placeholder: fa.filter.placeholder,
        catalog,
        label: (id) => ds.meta[id]?.label,
        compile: (text) => app.compile(text) ?? { ok: false, error: { code: 'NO_DATA', message: '' } },
        onChange: (text, result) => {
          state.text = text;
          replace(banner);
          if (!text.trim()) builder.setRoot((state.tree = emptyGroup()));
          else if (result?.ok) {
            const tree = fromAst(result.value.ast);
            if (tree) builder.setRoot((state.tree = tree));
            else banner.append(h('div', { class: 'ok-box', text: t.advanced }));
          }
          if (!result || result.ok) preview();
        },
      });
      const builder = new FilterBuilder(ds, state.tree, (tree) => {
        state.tree = tree;
        state.text = toExpression(tree);
        editor.setValue(state.text);
        replace(banner);
        preview();
      });

      const exportAs = (format: 'xlsx' | 'csv') => {
        const { idx, fields } = preview();
        exportRows(ds, idx, fields, `filter-${ds.fileName.replace(/\.\w+$/, '')}`, format);
      };

      append(body, [
        h(
          'div',
          { class: 'page-head' },
          h('h1', { class: 'grow', text: t.title }),
          h('button', {
            class: 'btn primary',
            text: t.applyGlobal,
            on: {
              click: () => {
                app.setFilterText(state.text);
                toast(t.applied, 'ok');
              },
            },
          }),
          h('button', { class: 'btn', text: t.savePreset, on: { click: () => void savePreset(app) } }),
        ),
        h(
          'div',
          { class: 'grid grid-2' },
          card(t.builder, builder.el),
          h(
            'div',
            { class: 'stack' },
            card(t.text, editor.el, banner),
            presetsCard(app, (text) => {
              editor.setValue(text);
              state.text = text;
              editor.textarea.dispatchEvent(new Event('input'));
            }),
          ),
        ),
        h(
          'section',
          { class: 'card' },
          h(
            'div',
            { class: 'card-head' },
            h('h2', { text: t.results }),
            counter,
            h('button', { class: 'btn sm', text: t.exportXlsx, on: { click: () => exportAs('xlsx') } }),
            h('button', { class: 'btn sm', text: t.exportCsv, on: { click: () => exportAs('csv') } }),
          ),
          results,
        ),
      ]);
      preview();
      return () => table?.destroy();
    },
    { filters: true },
  );
}

async function savePreset(app: App): Promise<void> {
  if (!state.text.trim()) return;
  const label = window.prompt(t.presetName, '');
  if (!label) return;
  await app.library.savePreset({ label, expression: state.text });
  toast(t.saved, 'ok');
  app.requestRender();
}

function presetsCard(app: App, load: (text: string) => void): HTMLElement {
  const list = h('div', { class: 'stack', style: 'gap:6px' });
  const draw = () =>
    replace(
      list,
      app.library.presets().map((p) =>
        h(
          'div',
          { class: 'row', style: 'flex-wrap:nowrap' },
          h('button', {
            class: 'link-btn grow',
            style: 'text-align:start',
            text: p.label,
            attrs: { title: p.expression },
            on: { click: () => load(p.expression) },
          }),
          p.builtIn ? h('span', { class: 'badge flag-chip', text: t.builtIn }) : null,
          h('button', {
            class: 'btn sm ghost',
            text: t.copy,
            on: {
              click: () =>
                void app.library
                  .savePreset({ label: `${p.label} ${fa.builder.copySuffix}`, expression: p.expression })
                  .then(draw),
            },
          }),
          p.builtIn
            ? null
            : h('button', {
                class: 'btn sm ghost',
                text: t.rename,
                on: {
                  click: () => {
                    const label = window.prompt(t.presetName, p.label);
                    if (label) void app.library.savePreset({ ...p, label }).then(draw);
                  },
                },
              }),
          p.builtIn
            ? null
            : h('button', {
                class: 'btn sm ghost',
                text: t.delete,
                on: {
                  click: () => {
                    if (window.confirm(t.confirmDelete)) void app.library.deletePreset(p.id).then(draw);
                  },
                },
              }),
        ),
      ),
    );
  draw();
  const exportBtn = h('button', {
    class: 'btn sm',
    text: t.export,
    on: { click: () => downloadText(app.library.exportPresets(), 'bourse-view-presets.json') },
  });
  const importBtn = h('button', {
    class: 'btn sm',
    text: t.import,
    on: {
      click: () =>
        void pickTextFile().then(async (text) => {
          if (!text) return;
          const r = await app.library.importPresets(text);
          if (r.ok) toast(t.imported(r.value), 'ok');
          else toast(r.error.message, 'error');
          draw();
        }),
    },
  });
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', { text: t.presets }), exportBtn, importBtn),
    list,
  );
}
