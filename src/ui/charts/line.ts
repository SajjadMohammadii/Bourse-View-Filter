import { chartTheme as t } from '../../config/theme';
import { axis, type ChartOption } from './echarts';

export interface LineSeries {
  name: string;
  values: Array<number | null>;
}

/** Time series over snapshot dates (labels are formatted Jalali dates). */
export function lineOption(
  labels: string[],
  series: LineSeries[],
  yName = '',
  yRange?: { min: number; max: number },
): ChartOption {
  return {
    grid: { left: 48, right: 16, top: series.length > 1 ? 32 : 16, bottom: 32 },
    legend: series.length > 1 ? { top: 0, textStyle: { color: t.textMuted } } : undefined,
    tooltip: { trigger: 'axis' },
    xAxis: { ...axis(), type: 'category', data: labels, boundaryGap: false, splitLine: { show: false } },
    yAxis: { ...axis(yName), type: 'value', ...yRange },
    series: series.map((s, k) => ({
      type: 'line',
      name: s.name,
      data: s.values,
      connectNulls: false,
      showSymbol: labels.length <= 30,
      symbolSize: 8,
      lineStyle: { width: 2, color: t.categorical[k % t.categorical.length] },
      itemStyle: { color: t.categorical[k % t.categorical.length] },
    })),
  };
}

/** Tiny inline trend line (no axes) for tables and drawers. */
export function sparklineOption(values: Array<number | null>): ChartOption {
  return {
    grid: { left: 2, right: 2, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [
      {
        type: 'line',
        data: values,
        showSymbol: false,
        lineStyle: { width: 2, color: t.accent },
        areaStyle: { color: t.accent, opacity: 0.1 },
      },
    ],
  };
}
