import { append, h } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page, PageContext } from '../page';
import type { Dataset } from '../../core/types';
import type { AppState } from '../../app/appState';
import { createDataPage } from './data-page';
import { kpiCard } from '../components/kpi';
import { fieldSelect } from '../components/field-select';
import { scoreBadge } from '../components/score';
import { ChartBag, card, meanOf, sortedBy, topGroups } from './page-helpers';
import { scatterOption, type ScatterPoint } from '../charts/scatterQuadrant';
import { treemapOption } from '../charts/matrix';
import { profiles } from '../../config/profiles';
import { fv } from '../format';

interface OverviewView {
  x: string;
  y: string;
  treemapColor: string;
}

const view: OverviewView = {
  x: 'score.fundamentalLong',
  y: 'score.technical',
  treemapColor: 'score.composite',
};
const TREEMAP_COLORS = ['score.composite', ...profiles.map((p) => `score.${p.id}`), 'Ret_1D'];
const RETURN_RANGE = 0.05;

export function createOverviewPage(ctx: PageContext): Page {
  return createDataPage(
    ctx,
    fa.overview.title,
    (body, ds, state) => {
      const bag = new ChartBag();
      const select = (s: string) => ctx.app.select(s);
      const idx = state.visible;
      append(body, [
        h('h1', { text: fa.overview.title }),
        kpis(ds, state),
        h(
          'div',
          { class: 'grid grid-2' },
          quadrant(bag, ds, idx, select, () => ctx.app.requestRender()),
          topTable(ds, idx, select),
        ),
        treemap(bag, ds, idx, select, () => ctx.app.requestRender()),
      ]);
      return () => bag.dispose();
    },
    { filters: true },
  );
}

function kpis(ds: Dataset, state: AppState): HTMLElement {
  const idx = state.visible;
  const risk = state.marketRisk?.modes[state.settings.marketRiskMode];
  const above = share(idx, (i) => {
    const p = ds.num['Price']?.[i] ?? NaN;
    const s = ds.num['SMA_200D']?.[i] ?? NaN;
    return Number.isFinite(p) && Number.isFinite(s) ? p > s : null;
  });
  const flow = idx.reduce(
    (a, i) =>
      a +
      (Number.isFinite(ds.num['NetIndividualValue']?.[i] ?? NaN)
        ? (ds.num['NetIndividualValue']?.[i] as number)
        : 0),
    0,
  );
  const count = (flag: string) => idx.filter((i) => ds.num[`flag.${flag}`]?.[i] === 1).length;
  return h(
    'div',
    { class: 'grid grid-kpi' },
    kpiCard({
      label: fa.overview.symbols,
      value: fv(idx.length, 'rank'),
      sub: `${fa.overview.symbols}: ${fv(ds.size, 'rank')}`,
    }),
    kpiCard({
      label: fa.overview.risk,
      value: risk?.thermometer == null ? '—' : fv(risk.thermometer, 'rank'),
      sub: risk?.regime?.label,
      tone:
        risk?.regime?.id === 'low'
          ? 'pos'
          : risk?.regime?.id === 'high' || risk?.regime?.id === 'critical'
            ? 'neg'
            : '',
    }),
    kpiCard({ label: fa.overview.aboveSma200, value: fv(above, 'percent') }),
    kpiCard({
      label: fa.overview.flow,
      value: fv(flow, 'rial'),
      tone: flow >= 0 ? 'pos' : 'neg',
      sub: flow >= 0 ? '▲' : '▼',
    }),
    profiles.map((p) =>
      kpiCard({ label: fa.overview.avgScore(p.label), value: fv(meanOf(ds, idx, `score.${p.id}`), 'score') }),
    ),
    kpiCard({
      label: fa.overview.transforms,
      value: `${fv(count('turnaroundQ'), 'rank')} / ${fv(count('recordMonth'), 'rank')}`,
    }),
  );
}

function share(idx: number[], pred: (i: number) => boolean | null): number {
  let yes = 0;
  let n = 0;
  for (const i of idx) {
    const r = pred(i);
    if (r === null) continue;
    n++;
    if (r) yes++;
  }
  return n ? yes / n : NaN;
}

function quadrant(
  bag: ChartBag,
  ds: Dataset,
  idx: number[],
  select: (s: string) => void,
  redraw: () => void,
): HTMLElement {
  const xs = ds.num[view.x];
  const ys = ds.num[view.y];
  const usable = idx.filter((i) => Number.isFinite(xs?.[i] ?? NaN) && Number.isFinite(ys?.[i] ?? NaN));
  const { groups, groupOf, other } = topGroups(ds, usable);
  const points: ScatterPoint[] = usable.map((i) => ({
    name: ds.symbols[i] ?? '',
    label: ds.text['Company']?.[i] ?? '',
    x: xs?.[i] as number,
    y: ys?.[i] as number,
    size: ds.num['MarketCap']?.[i] ?? 0,
    group: groupOf(i),
  }));
  const isScore = (f: string) => ds.meta[f]?.unit === 'score';
  const quadrants =
    isScore(view.x) && isScore(view.y)
      ? {
          topRight: fa.overview.stars,
          bottomRight: fa.overview.forgotten,
          topLeft: fa.overview.bubbles,
          bottomLeft: fa.overview.avoid,
        }
      : undefined;
  const xLabel = ds.meta[view.x]?.label ?? view.x;
  const yLabel = ds.meta[view.y]?.label ?? view.y;
  const tip = (p: ScatterPoint) =>
    `<b>${p.name}</b> — ${p.label}<br/>${xLabel}: ${fv(p.x, ds.meta[view.x]?.unit ?? 'number')}<br/>${yLabel}: ${fv(p.y, ds.meta[view.y]?.unit ?? 'number')}<br/>${fv(p.size, 'rial')}`;
  const axisPicker = (key: 'x' | 'y', label: string) => {
    const sel = fieldSelect(ds, { placeholder: label, value: view[key], filter: (m) => m.kind === 'num' });
    sel.addEventListener('change', () => {
      if (sel.value) view[key] = sel.value;
      redraw();
    });
    return h('label', { class: 'row' }, h('span', { class: 'muted', text: label }), sel);
  };
  return bag.card(
    fa.overview.quadrant,
    scatterOption(points, groups, other, xLabel, yLabel, quadrants, tip),
    `${fa.overview.quadrant}: ${points.length}`,
    {
      size: 'tall',
      hint: fa.overview.quadrantHint,
      head: h(
        'div',
        { class: 'row' },
        axisPicker('x', fa.overview.xAxis),
        axisPicker('y', fa.overview.yAxis),
      ),
      onClick: select,
    },
  );
}

function topTable(ds: Dataset, idx: number[], select: (s: string) => void): HTMLElement {
  const top = sortedBy(ds, idx, 'score.composite').slice(0, 10);
  const rows = top.map((i) =>
    h(
      'tr',
      {
        attrs: { tabindex: 0 },
        style: 'cursor:pointer',
        on: {
          click: () => select(ds.symbols[i] ?? ''),
          keydown: (e) => e.key === 'Enter' && select(ds.symbols[i] ?? ''),
        },
      },
      h('td', {}, h('bdi', { class: 'num', text: fv(ds.num['rank.composite']?.[i], 'rank') })),
      h('td', {}, h('b', { text: ds.symbols[i] ?? '' })),
      h('td', { class: 'muted', text: ds.text['Industry']?.[i] ?? '' }),
      h('td', {}, scoreBadge(ds.num['score.composite']?.[i])),
      profiles.map((p) =>
        h('td', {}, h('bdi', { class: 'num', text: fv(ds.num[`score.${p.id}`]?.[i], 'score') })),
      ),
    ),
  );
  return card(
    fa.overview.top10,
    h(
      'table',
      { class: 'simple-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { text: fa.score.rank }),
          h('th', { text: fa.profile.symbol }),
          h('th', { text: fa.profile.industry }),
          h('th', { text: fa.score.composite }),
          profiles.map((p) => h('th', { text: p.label })),
        ),
      ),
      h('tbody', {}, rows),
    ),
    h('h3', { style: 'margin-top:16px', text: fa.overview.newcomers }),
    newcomers(ds, idx, select),
  );
}

/** Symbols that entered the composite Top 20 since the previous snapshot (needs history, PLAN.md §13). */
function newcomers(ds: Dataset, idx: number[], select: (s: string) => void): HTMLElement {
  const prevRank = ds.num['prev.rank.composite'];
  if (!prevRank) return h('p', { class: 'faint', text: fa.overview.newcomersEmpty });
  const list = sortedBy(ds, idx, 'score.composite')
    .slice(0, 20)
    .filter((i) => !((prevRank[i] ?? NaN) <= 20));
  return h(
    'div',
    { class: 'row' },
    list.map((i) =>
      h('button', {
        class: 'chip active',
        text: `▲ ${ds.symbols[i]}`,
        on: { click: () => select(ds.symbols[i] ?? '') },
      }),
    ),
  );
}

function treemap(
  bag: ChartBag,
  ds: Dataset,
  idx: number[],
  select: (s: string) => void,
  redraw: () => void,
): HTMLElement {
  const color = view.treemapColor;
  const isReturn = color === 'Ret_1D';
  const items = idx.map((i) => ({
    name: ds.symbols[i] ?? '',
    label: ds.text['Company']?.[i] ?? '',
    value: ds.num['MarketCap']?.[i] ?? 0,
    colorValue: ds.num[color]?.[i] ?? NaN,
  }));
  const picker = h(
    'select',
    { class: 'select', attrs: { 'aria-label': fa.overview.treemapColor } },
    TREEMAP_COLORS.map((f) =>
      h('option', {
        attrs: { value: f, selected: f === color },
        text: f === 'Ret_1D' ? fa.overview.ret1d : (ds.meta[f]?.label ?? f),
      }),
    ),
  );
  picker.addEventListener('change', () => {
    view.treemapColor = picker.value;
    redraw();
  });
  const range = isReturn ? { min: -RETURN_RANGE, max: RETURN_RANGE, diverging: true } : { min: 0, max: 100 };
  const tip = (it: (typeof items)[number]) =>
    `<b>${it.name}</b> — ${it.label}<br/>${fv(it.value, 'rial')}<br/>${ds.meta[color]?.label ?? color}: ${fv(it.colorValue, isReturn ? 'percent' : 'score')}`;
  return bag.card(fa.overview.treemap, treemapOption(items, range, tip), fa.overview.treemap, {
    size: 'tall',
    head: h('label', { class: 'row' }, h('span', { class: 'muted', text: fa.overview.treemapColor }), picker),
    onClick: select,
  });
}
