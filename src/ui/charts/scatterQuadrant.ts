import { chartTheme as t } from '../../config/theme';
import { axis, type ChartOption } from './echarts';

export interface ScatterPoint {
  name: string;
  label: string;
  x: number;
  y: number;
  size: number;
  group: string;
}

export interface QuadrantLabels {
  topRight: string;
  bottomRight: string;
  topLeft: string;
  bottomLeft: string;
}

const MIN_SIZE = 6;
const MAX_SIZE = 34;

/** Bubble scatter; groups get fixed categorical slots in order, the last group is "other" (neutral). */
export function scatterOption(
  points: ScatterPoint[],
  groups: string[],
  otherGroup: string | null,
  xName: string,
  yName: string,
  quadrants?: QuadrantLabels,
  fmt?: (p: ScatterPoint) => string,
): ChartOption {
  const maxSize = Math.max(1, ...points.map((p) => p.size).filter(Number.isFinite));
  const size = (v: number) =>
    Number.isFinite(v) && v > 0 ? MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt(v / maxSize) : MIN_SIZE;
  const series = groups.map((g, k) => ({
    type: 'scatter',
    name: g,
    data: points
      .filter((p) => p.group === g)
      .map((p) => ({ name: p.name, value: [p.x, p.y, p.size], label: p.label, point: p })),
    symbolSize: (v: number[]) => size(v[2] ?? 0),
    itemStyle: {
      color: g === otherGroup ? t.other : t.categorical[k % t.categorical.length],
      opacity: g === otherGroup ? 0.45 : 0.8,
      borderColor: t.surface,
      borderWidth: 1,
    },
    emphasis: { focus: 'series' },
    ...(k === 0 && quadrants ? quadrantMarks(quadrants) : {}),
  }));
  return {
    grid: { left: 56, right: 24, top: 40, bottom: 48 },
    legend: { top: 0, textStyle: { color: t.textMuted } },
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: { point: ScatterPoint } }) => (fmt ? fmt(p.data.point) : p.data.point.name),
    },
    // Quadrant charts are 0–100 score planes; keep the 50/50 lines in view.
    xAxis: {
      ...axis(xName),
      type: 'value',
      nameLocation: 'middle',
      nameGap: 28,
      ...(quadrants ? { min: 0, max: 100 } : { scale: true }),
    },
    yAxis: {
      ...axis(yName),
      type: 'value',
      nameLocation: 'middle',
      nameGap: 40,
      ...(quadrants ? { min: 0, max: 100 } : { scale: true }),
    },
    series,
  };
}

function quadrantMarks(q: QuadrantLabels) {
  const label = (text: string, position: string) => ({
    show: true,
    position,
    color: t.textFaint,
    fontSize: 12,
    formatter: text,
  });
  return {
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: t.border, type: 'dashed' },
      label: { show: false },
      data: [{ xAxis: 50 }, { yAxis: 50 }],
    },
    markArea: {
      silent: true,
      itemStyle: { color: 'transparent' },
      data: [
        [{ coord: [50, 50], label: label(q.topRight, 'insideTopRight') }, { coord: [100, 100] }],
        [{ coord: [50, 0], label: label(q.bottomRight, 'insideBottomRight') }, { coord: [100, 50] }],
        [{ coord: [0, 50], label: label(q.topLeft, 'insideTopLeft') }, { coord: [50, 100] }],
        [{ coord: [0, 0], label: label(q.bottomLeft, 'insideBottomLeft') }, { coord: [50, 50] }],
      ],
    },
  };
}
