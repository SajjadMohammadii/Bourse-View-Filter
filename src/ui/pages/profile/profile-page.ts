import { append, h, replace } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { Page, PageContext } from '../../page';
import type { Dataset } from '../../../core/types';
import type { PeerMode, ProfileDef } from '../../../core/scoring/types';
import type { App } from '../../../app/appState';
import { createDataPage } from '../data-page';
import { DataTable } from '../../components/data-table';
import { profileColumns, profileRows } from './profile-table';
import { presetSelect, weightsEditor } from './weights-editor';
import { profileCharts } from './profile-charts';
import { ChartBag, sortedBy } from '../page-helpers';
import { exportRows } from '../../../app/services/exportService';
import { num } from '../../format';

type Tab = 'best' | 'worst' | 'all' | 'transformed';

interface ViewState {
  tab: Tab;
  topN: number;
  pageFilter: string;
  editing: boolean;
}

/** Page-local UI state survives re-renders (filter changes, rescoring). */
const views = new Map<string, ViewState>();
const TOP_N_OPTIONS = [10, 20, 50];

/** Transformation index per profile (PLAN.md §9, §10). */
const transformScore: Record<string, string> = {
  fundamentalQuarterly: 'qTransform',
  fundamentalMonthly: 'mTransform',
};

export function createProfilePage(ctx: PageContext, p: ProfileDef): Page {
  const view = views.get(p.id) ?? { tab: 'best', topN: 20, pageFilter: '', editing: false };
  views.set(p.id, view);

  return createDataPage(
    ctx,
    p.label,
    (body, ds, state) => {
      const bag = new ChartBag();
      let table: DataTable | null = null;
      const base = ctx.app.narrow(state.visible, view.pageFilter);
      const indices = base.filter((i) => ds.num[`eligible.${p.id}`]?.[i] !== 0);
      const tableHost = h('div');
      const tabsEl = h('div', { class: 'tabs', attrs: { role: 'tablist' } });

      const drawTable = () => {
        table?.destroy();
        const rows = profileRows(ds, p, tabIndices(ds, p, indices, view));
        table = new DataTable(tableHost, {
          columns: profileColumns(ds, p),
          rows,
          height: view.tab === 'all' ? '600px' : `${Math.min(600, 80 + rows.length * 38)}px`,
          onRowClick: (r) => ctx.app.select(String(r['Symbol'] ?? '')),
        });
      };
      const drawTabs = () =>
        replace(
          tabsEl,
          tabsFor(p).map(([id, label]) =>
            h('button', {
              text: label,
              attrs: { role: 'tab', 'aria-selected': view.tab === id },
              on: {
                click: () => {
                  view.tab = id;
                  drawTabs();
                  drawTable();
                },
              },
            }),
          ),
        );

      append(body, [
        header(ctx.app, p, view),
        view.editing ? weightsEditor(ctx.app, p) : null,
        h(
          'section',
          { class: 'card' },
          h(
            'div',
            { class: 'card-head' },
            tabsEl,
            topNSelect(view, drawTable),
            pageFilterInput(ctx.app, view),
            h('button', {
              class: 'btn sm',
              text: fa.studio.exportXlsx,
              on: { click: () => exportProfile(ds, p, tabIndices(ds, p, indices, view)) },
            }),
          ),
          tableHost,
        ),
        h(
          'div',
          { class: 'grid grid-2' },
          profileCharts(bag, ds, p, indices, view.topN, (s) => ctx.app.select(s)),
        ),
      ]);
      drawTabs();
      drawTable();
      return () => {
        table?.destroy();
        bag.dispose();
      };
    },
    { filters: true },
  );
}

function tabsFor(p: ProfileDef): Array<[Tab, string]> {
  const tabs: Array<[Tab, string]> = [
    ['best', fa.profile.best],
    ['worst', fa.profile.worst],
    ['all', fa.profile.all],
  ];
  if (transformScore[p.id]) tabs.push(['transformed', fa.profile.transformed]);
  return tabs;
}

function tabIndices(ds: Dataset, p: ProfileDef, indices: number[], view: ViewState): number[] {
  switch (view.tab) {
    case 'best':
      return sortedBy(ds, indices, `score.${p.id}`, 'desc').slice(0, view.topN);
    case 'worst':
      return sortedBy(ds, indices, `score.${p.id}`, 'asc').slice(0, view.topN);
    case 'transformed':
      return sortedBy(ds, indices, `score.${transformScore[p.id]}`, 'desc').slice(0, view.topN);
    default:
      return sortedBy(ds, indices, `score.${p.id}`, 'desc').concat(
        indices.filter((i) => !Number.isFinite(ds.num[`score.${p.id}`]?.[i] ?? NaN)),
      );
  }
}

function header(app: App, p: ProfileDef, view: ViewState): HTMLElement {
  const edit = h('button', {
    class: 'btn sm',
    text: fa.profile.editWeights,
    attrs: { 'aria-pressed': view.editing },
    on: {
      click: () => {
        view.editing = !view.editing;
        app.requestRender();
      },
    },
  });
  const status = h('span', { class: 'row muted' });
  const showStatus = (busy: boolean) =>
    replace(status, busy ? [h('span', { class: 'spinner' }), fa.profile.rescoring] : []);
  showStatus(app.store.get().rescoring);
  const unsub = app.store.subscribe((s, prev) => {
    if (!status.isConnected) return unsub();
    if (s.rescoring !== prev.rescoring) showStatus(s.rescoring);
  });
  return h(
    'div',
    { class: 'page-head' },
    h('div', { class: 'grow' }, h('h1', { text: p.label }), h('p', { class: 'muted', text: p.description })),
    status,
    h(
      'label',
      { class: 'row' },
      h('span', { class: 'muted', text: fa.profile.preset }),
      presetSelect(app, p),
    ),
    edit,
    peerModeSeg(app),
  );
}

function peerModeSeg(app: App): HTMLElement {
  const current = app.store.get().settings.scoring.peerMode;
  const modes: Array<[PeerMode, string]> = [
    ['default', fa.profile.peerDefault],
    ['market', fa.profile.peerMarket],
    ['industry', fa.profile.peerIndustry],
    ['blend', fa.profile.peerBlend],
  ];
  return h(
    'div',
    { class: 'row' },
    h('span', { class: 'muted', text: fa.profile.peerMode }),
    h(
      'div',
      { class: 'seg', attrs: { role: 'group', 'aria-label': fa.profile.peerMode } },
      modes.map(([id, label]) =>
        h('button', {
          text: label,
          attrs: { 'aria-pressed': id === current },
          on: {
            click: () =>
              app.updateSettings({ scoring: { ...app.store.get().settings.scoring, peerMode: id } }),
          },
        }),
      ),
    ),
  );
}

function topNSelect(view: ViewState, onChange: () => void): HTMLElement {
  const select = h(
    'select',
    { class: 'select', attrs: { 'aria-label': fa.profile.topN } },
    TOP_N_OPTIONS.map((n) =>
      h('option', { attrs: { value: n, selected: n === view.topN }, text: num(n, 0) }),
    ),
  );
  select.addEventListener('change', () => {
    view.topN = Number(select.value);
    onChange();
  });
  return h('label', { class: 'row' }, h('span', { class: 'muted', text: fa.profile.topN }), select);
}

function pageFilterInput(app: App, view: ViewState): HTMLElement {
  const input = h('input', {
    class: 'input mono',
    attrs: {
      type: 'text',
      value: view.pageFilter,
      placeholder: fa.filter.pagePlaceholder,
      'aria-label': fa.filter.page,
      dir: 'ltr',
      spellcheck: 'false',
    },
    style: 'min-width:260px;flex:1',
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const c = input.value.trim() ? app.compile(input.value) : null;
    if (c && !c.ok) {
      input.classList.add('invalid');
      input.title = c.error.message;
      return;
    }
    view.pageFilter = input.value;
    app.requestRender();
  });
  return input;
}

/** Exports the current tab (symbols, scores, factors, confidence) to Excel. */
function exportProfile(ds: Dataset, p: ProfileDef, idx: number[]): void {
  const fields = [
    'Symbol',
    'Company',
    'Industry',
    `rank.${p.id}`,
    `score.${p.id}`,
    `grade.${p.id}`,
    `conf.${p.id}`,
    ...p.factors.map((f) => `factor.${p.id}.${f.id}`),
  ].filter((f) => ds.meta[f]);
  exportRows(ds, idx, fields, `${p.id}-${ds.fileName.replace(/\.\w+$/, '')}`, 'xlsx');
}
