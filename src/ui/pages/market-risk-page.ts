import { append, h } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page, PageContext } from '../page';
import type { Dataset } from '../../core/types';
import type { MarketRiskResult, MarketRiskSnapshot, WeightingMode } from '../../core/market/types';
import type { App, RiskSeries } from '../../app/appState';
import { createDataPage } from './data-page';
import { ChartBag, card, clampTo, robustRange, topGroups } from './page-helpers';
import { gaugeOption } from '../charts/gauge';
import { heatmapOption } from '../charts/matrix';
import { divergingBarOption } from '../charts/distribution';
import { scatterOption, type ScatterPoint } from '../charts/scatterQuadrant';
import { lineOption } from '../charts/line';
import { marketRiskConfig } from '../../config/marketRisk';
import { chartTheme } from '../../config/theme';
import { fv } from '../format';

const MODES: Array<[WeightingMode, string]> = [
  ['equal', fa.risk.equal],
  ['cap', fa.risk.cap],
  ['sqrtCap', fa.risk.sqrtCap],
];

export function createMarketRiskPage(ctx: PageContext): Page {
  return createDataPage(
    ctx,
    fa.risk.title,
    (body, ds, state) => {
      const risk = state.marketRisk;
      if (!risk) return;
      const bag = new ChartBag();
      const mode = state.settings.marketRiskMode;
      const snap = risk.modes[mode];
      append(body, [
        h(
          'div',
          { class: 'page-head' },
          h('h1', { class: 'grow', text: fa.risk.title }),
          modeSeg(ctx.app, mode),
        ),
        h('div', { class: 'grid grid-2' }, gaugeCard(bag, snap), componentsCard(snap)),
        h('div', { class: 'grid grid-2' }, sectorHeatmap(bag, risk, mode), sectorFlow(bag, risk, mode)),
        h(
          'div',
          { class: 'grid grid-2' },
          timeline(bag, state.riskSeries),
          betaScatter(bag, ds, state.visible, (s) => ctx.app.select(s)),
        ),
      ]);
      return () => bag.dispose();
    },
    { filters: false },
  );
}

function modeSeg(app: App, current: WeightingMode): HTMLElement {
  return h(
    'div',
    { class: 'row' },
    h('span', { class: 'muted', text: fa.risk.weighting }),
    h(
      'div',
      { class: 'seg', attrs: { role: 'group', 'aria-label': fa.risk.weighting } },
      MODES.map(([id, label]) =>
        h('button', {
          text: label,
          attrs: { 'aria-pressed': id === current },
          on: { click: () => app.updateSettings({ marketRiskMode: id }, false) },
        }),
      ),
    ),
  );
}

function gaugeCard(bag: ChartBag, snap: MarketRiskSnapshot): HTMLElement {
  const regime = snap.regime;
  const summary = `${fa.risk.thermometer}: ${fv(snap.thermometer ?? NaN, 'rank')} — ${regime?.label ?? ''}`;
  const el = bag.card(
    fa.risk.thermometer,
    gaugeOption(snap.thermometer, marketRiskConfig.regimes, regime?.label ?? ''),
    summary,
    {
      hint: snap.historyBased ? fa.risk.historyBased : fa.risk.absoluteBased,
    },
  );
  el.append(
    h(
      'div',
      { class: 'row', style: 'justify-content:center' },
      marketRiskConfig.regimes.map((r) =>
        h(
          'span',
          { class: 'badge flag-chip', style: `border-color:${chartTheme.regimes[r.id]}` },
          `● ${r.label} < ${fv(Math.min(r.max, 100), 'rank')}`,
        ),
      ),
    ),
  );
  return el;
}

function componentsCard(snap: MarketRiskSnapshot): HTMLElement {
  const unitOf = new Map(marketRiskConfig.components.map((c) => [c.id, c.unit]));
  const descOf = new Map(marketRiskConfig.components.map((c) => [c.id, c.description]));
  return card(
    fa.risk.components,
    h(
      'table',
      { class: 'simple-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          [fa.risk.component, fa.risk.value, fa.risk.riskScore, fa.risk.weight].map((t) =>
            h('th', { text: t }),
          ),
        ),
      ),
      h(
        'tbody',
        {},
        snap.components.map((c) => {
          const r = c.risk ?? NaN;
          const color = r >= 55 ? 'var(--negative)' : r >= 30 ? 'var(--blue-500)' : 'var(--turquoise-500)';
          return h(
            'tr',
            { attrs: { title: descOf.get(c.id) ?? '' } },
            h('td', { text: c.label }),
            h('td', {}, h('bdi', { class: 'num', text: fv(c.value ?? NaN, unitOf.get(c.id) ?? 'number') })),
            h(
              'td',
              {},
              h(
                'div',
                { class: 'row', style: 'flex-wrap:nowrap' },
                h(
                  'div',
                  { class: 'meter', style: 'width:90px' },
                  h('i', { style: `width:${Number.isFinite(r) ? r : 0}%;background:${color}` }),
                ),
                h('bdi', { class: 'num', text: `${fv(r, 'rank')} ${r >= 55 ? '▲' : r < 30 ? '▼' : ''}` }),
              ),
            ),
            h('td', {}, h('bdi', { class: 'num muted', text: fv(c.weight, 'percent') })),
          );
        }),
      ),
    ),
  );
}

function sectorHeatmap(bag: ChartBag, risk: MarketRiskResult, mode: WeightingMode): HTMLElement {
  const sectors = risk.bySector[mode]
    .filter((s) => s.count >= 3)
    .sort((a, b) => (b.snapshot.thermometer ?? 0) - (a.snapshot.thermometer ?? 0));
  const comps = marketRiskConfig.components;
  const cols = [fa.risk.thermometer, ...comps.map((c) => c.label)];
  const cells: Array<[number, number, number | null]> = [];
  sectors.forEach((s, r) => {
    cells.push([0, r, s.snapshot.thermometer]);
    s.snapshot.components.forEach((c, k) => cells.push([k + 1, r, c.risk]));
  });
  return bag.card(
    fa.risk.sectorHeatmap,
    heatmapOption(
      sectors.map((s) => s.sector),
      cols,
      cells,
      // Risk: low = turquoise (good), high = red.
      { diverging: true, reverse: true },
    ),
    fa.risk.sectorHeatmap,
    { size: 'tall' },
  );
}

function sectorFlow(bag: ChartBag, risk: MarketRiskResult, mode: WeightingMode): HTMLElement {
  const items = risk.bySector[mode].map((s) => ({ label: s.sector, value: s.netIndividualValue ?? NaN }));
  return bag.card(
    fa.risk.sectorFlow,
    divergingBarOption(items, fa.overview.flow, (v) => fv(v, 'rial')),
    fa.risk.sectorFlow,
    { size: 'tall' },
  );
}

/** Thermometer and breadth over stored snapshots (filled once history exists, PLAN.md §13). */
function timeline(bag: ChartBag, series: RiskSeries | null): HTMLElement {
  if (!series || series.labels.length < 2)
    return card(fa.risk.timeline, h('p', { class: 'faint', text: fa.risk.timelineEmpty }));
  return bag.card(
    fa.risk.timeline,
    lineOption(
      series.labels,
      [
        { name: fa.risk.thermometer, values: series.thermometer },
        {
          name: marketRiskConfig.components.find((c) => c.id === 'breadth')?.label ?? 'breadth',
          values: series.breadth.map((v) => (v === null ? null : v * 100)),
        },
      ],
      '',
      { min: 0, max: 100 },
    ),
    fa.risk.timeline,
  );
}

function betaScatter(bag: ChartBag, ds: Dataset, idx: number[], select: (s: string) => void): HTMLElement {
  const beta = ds.num['Beta_60W'];
  const std = ds.num['StdDev_90D'];
  const usable = idx.filter((i) => Number.isFinite(beta?.[i] ?? NaN) && Number.isFinite(std?.[i] ?? NaN));
  const cx = clampTo(robustRange(usable.map((i) => beta?.[i] ?? NaN)));
  const cy = clampTo(robustRange(usable.map((i) => std?.[i] ?? NaN)));
  const { groups, groupOf, other } = topGroups(ds, usable);
  const points: ScatterPoint[] = usable.map((i) => ({
    name: ds.symbols[i] ?? '',
    label: ds.text['Company']?.[i] ?? '',
    x: cx(beta?.[i] ?? NaN),
    y: cy(std?.[i] ?? NaN),
    size: ds.num['MarketCap']?.[i] ?? 0,
    group: groupOf(i),
  }));
  const tip = (p: ScatterPoint) =>
    `<b>${p.name}</b> — ${p.label}<br/>${fa.risk.beta}: ${fv(p.x, 'number')}<br/>${fa.risk.std}: ${fv(p.y, 'percent')}`;
  return bag.card(
    fa.risk.betaVsStd,
    scatterOption(points, groups, other, fa.risk.beta, fa.risk.std, undefined, tip),
    fa.risk.betaVsStd,
    {
      size: 'tall',
      onClick: select,
    },
  );
}
