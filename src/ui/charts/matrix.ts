import { chartTheme as t } from '../../config/theme';
import { axis, type ChartOption } from './echarts';
import { num } from '../format';

/** Heatmap of 0–100 values (rows × columns). `diverging` centers the scale on 50. */
export function heatmapOption(
  rows: string[],
  cols: string[],
  values: Array<[col: number, row: number, value: number | null]>,
  opts: {
    diverging?: boolean;
    reverse?: boolean;
    min?: number;
    max?: number;
    format?: (v: number) => string;
  } = {},
): ChartOption {
  const fmt = opts.format ?? ((v: number) => num(v, 0));
  const ramp = opts.diverging ? t.diverging : t.sequential;
  return {
    grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
    tooltip: {
      position: 'top',
      formatter: (p: { value: [number, number, number | null] }) =>
        `${rows[p.value[1]]} · ${cols[p.value[0]]}<br/><b>${p.value[2] === null ? '—' : fmt(p.value[2])}</b>`,
    },
    xAxis: {
      ...axis(),
      type: 'category',
      data: cols,
      splitArea: { show: false },
      axisLabel: { color: t.text, interval: 0, rotate: cols.length > 8 ? 30 : 0 },
    },
    yAxis: { ...axis(), type: 'category', data: rows, inverse: true, axisLabel: { color: t.text } },
    visualMap: {
      min: opts.min ?? 0,
      max: opts.max ?? 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemHeight: 160,
      textStyle: { color: t.textMuted },
      formatter: (v: number) => fmt(v),
      inRange: { color: opts.reverse ? [...ramp].reverse() : ramp },
    },
    series: [
      {
        type: 'heatmap',
        data: values.map(([c, r, v]) => [c, r, v === null || !Number.isFinite(v) ? null : v]),
        label: {
          show: rows.length * cols.length <= 160,
          color: t.text,
          fontSize: 10,
          formatter: (p: { value: [number, number, number | null] }) =>
            p.value[2] === null ? '' : fmt(p.value[2]),
        },
        itemStyle: { borderColor: t.surface, borderWidth: 2 },
      },
    ],
  };
}

export interface TreemapItem {
  name: string;
  label: string;
  value: number;
  colorValue: number;
}

/** Market treemap: area = market cap, color = a 0–100 score (or a diverging return). */
export function treemapOption(
  items: TreemapItem[],
  range: { min: number; max: number; diverging?: boolean },
  tooltip: (i: TreemapItem) => string,
): ChartOption {
  return {
    tooltip: { formatter: (p: { data: { item: TreemapItem } }) => tooltip(p.data.item) },
    visualMap: {
      type: 'continuous',
      min: range.min,
      max: range.max,
      dimension: 1,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 160,
      textStyle: { color: t.textMuted },
      inRange: { color: range.diverging ? t.diverging : t.sequential },
      seriesIndex: 0,
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        bottom: 36,
        width: '100%',
        visualDimension: 1,
        label: { show: true, formatter: '{b}', color: t.text, fontFamily: t.font },
        itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2 },
        data: items
          .filter((i) => i.value > 0)
          .map((i) => ({
            name: i.name,
            value: [i.value, Number.isFinite(i.colorValue) ? i.colorValue : (range.min + range.max) / 2],
            item: i,
          })),
      },
    ],
  };
}
