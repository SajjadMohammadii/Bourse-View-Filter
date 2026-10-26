import { fa } from '../../../i18n/fa';
import type { Dataset } from '../../../core/types';
import type { ProfileDef } from '../../../core/scoring/types';
import { heatmapOption } from '../../charts/matrix';
import { hBarOption, histogramOption } from '../../charts/distribution';
import { scatterOption, type ScatterPoint } from '../../charts/scatterQuadrant';
import { ChartBag, clampTo, groupIndices, meanOf, robustRange, sortedBy, topGroups } from '../page-helpers';
import { fv } from '../../format';

/** Scatter axes for the transformation views (PLAN.md §12.3-ب). */
const scatterAxes: Record<string, { x: string; y: string; title: string }> = {
  fundamentalQuarterly: { x: 'NIQtrlyGR_YoY', y: 'D_FwdPE_Q', title: fa.profile.growthVsPe },
  fundamentalMonthly: { x: 'D_Rev1M_toAvg12_real', y: 'D_ImpliedPE_M', title: fa.profile.revVsPe },
};

export function profileCharts(
  bag: ChartBag,
  ds: Dataset,
  p: ProfileDef,
  indices: number[],
  topN: number,
  select: (symbol: string) => void,
): HTMLElement[] {
  const score = `score.${p.id}`;
  const top = sortedBy(ds, indices, score, 'desc').slice(0, topN);
  const factorLabels = p.factors.map((f) => f.id);
  const cells: Array<[number, number, number | null]> = [];
  top.forEach((i, r) =>
    p.factors.forEach((f, c) => {
      const v = ds.num[`factor.${p.id}.${f.id}`]?.[i];
      cells.push([c, r, v !== undefined && Number.isFinite(v) ? v : null]);
    }),
  );
  const values = indices.map((i) => ds.num[score]?.[i] ?? NaN).filter(Number.isFinite);
  const sectors = [...groupIndices(ds, indices, 'Sector')].map(([label, idx]) => ({
    label,
    value: meanOf(ds, idx, score),
  }));

  const charts = [
    bag.card(
      fa.profile.heatmap,
      heatmapOption(
        top.map((i) => ds.symbols[i] ?? ''),
        factorLabels,
        cells,
      ),
      `${fa.profile.heatmap}: ${fa.builder.heatmapSummary(top.length, p.factors.length)}`,
      { size: 'tall', onClick: select, hint: p.factors.map((f) => `${f.id}: ${f.label}`).join(' · ') },
    ),
    bag.card(
      fa.profile.distribution,
      histogramOption(values, fa.profile.count, fa.profile.median),
      `${fa.profile.distribution} (${values.length})`,
    ),
    bag.card(
      fa.profile.bySector,
      hBarOption(sectors, p.label, (v) => fv(v, 'score'), 100),
      fa.profile.bySector,
      { size: 'tall' },
    ),
  ];
  const axes = scatterAxes[p.id];
  if (axes) charts.push(transformScatter(bag, ds, indices, axes, select));
  return charts;
}

function transformScatter(
  bag: ChartBag,
  ds: Dataset,
  indices: number[],
  axes: { x: string; y: string; title: string },
  select: (s: string) => void,
): HTMLElement {
  const xs = ds.num[axes.x];
  const ys = ds.num[axes.y];
  const usable = indices.filter((i) => Number.isFinite(xs?.[i] ?? NaN) && Number.isFinite(ys?.[i] ?? NaN));
  const clampX = clampTo(robustRange(usable.map((i) => xs?.[i] ?? NaN)));
  const clampY = clampTo(robustRange(usable.map((i) => ys?.[i] ?? NaN)));
  const { groups, groupOf, other } = topGroups(ds, usable);
  const points: ScatterPoint[] = usable.map((i) => ({
    name: ds.symbols[i] ?? '',
    label: ds.text['Company']?.[i] ?? '',
    x: clampX(xs?.[i] ?? NaN),
    y: clampY(ys?.[i] ?? NaN),
    size: ds.num['MarketCap']?.[i] ?? 0,
    group: groupOf(i),
  }));
  const xLabel = ds.meta[axes.x]?.label ?? axes.x;
  const yLabel = ds.meta[axes.y]?.label ?? axes.y;
  const tip = (pt: ScatterPoint) =>
    `<b>${pt.name}</b> — ${pt.label}<br/>${xLabel}: ${fv(pt.x, ds.meta[axes.x]?.unit ?? 'number')}<br/>${yLabel}: ${fv(pt.y, ds.meta[axes.y]?.unit ?? 'number')}`;
  return bag.card(
    axes.title,
    scatterOption(points, groups, other, xLabel, yLabel, undefined, tip),
    axes.title,
    { size: 'tall', onClick: select },
  );
}
