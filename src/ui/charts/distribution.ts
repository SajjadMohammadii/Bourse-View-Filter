import { chartTheme as t } from '../../config/theme';
import { axis, type ChartOption } from './echarts';
import { median } from '../../core/utils/stats';
import { num } from '../format';

/** Histogram of 0–100 scores in fixed-width bins with a median line. */
export function histogramOption(
  values: number[],
  countLabel: string,
  medianLabel: string,
  binWidth = 5,
): ChartOption {
  const bins = Math.ceil(100 / binWidth);
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.max(0, Math.floor(v / binWidth)))]! += 1;
  const labels = counts.map((_, k) => num(k * binWidth, 0));
  const med = median(values);
  const medBin = Number.isFinite(med) ? Math.min(bins - 1, Math.floor(med / binWidth)) : null;
  return {
    grid: { left: 44, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: { ...axis(), type: 'category', data: labels, splitLine: { show: false } },
    yAxis: { ...axis(countLabel), type: 'value' },
    series: [
      {
        type: 'bar',
        name: countLabel,
        data: counts,
        barCategoryGap: '8%',
        itemStyle: { color: t.categorical[0], borderRadius: [4, 4, 0, 0] },
        markLine:
          medBin === null
            ? undefined
            : {
                symbol: 'none',
                lineStyle: { color: t.warning, type: 'dashed', width: 2 },
                label: {
                  color: t.text,
                  formatter: `${medianLabel}: ${num(med, 1)}`,
                },
                data: [{ xAxis: medBin }],
              },
      },
    ],
  };
}

export interface BarItem {
  label: string;
  value: number;
}

/** Horizontal bars sorted descending; for categories such as sectors. */
export function hBarOption(
  items: BarItem[],
  valueName: string,
  format: (v: number) => string,
  max?: number,
): ChartOption {
  const sorted = [...items].filter((i) => Number.isFinite(i.value)).sort((a, b) => a.value - b.value);
  return {
    grid: { left: 16, right: 56, top: 8, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => format(v) },
    xAxis: { ...axis(valueName), type: 'value', max, position: 'bottom' },
    yAxis: {
      ...axis(),
      type: 'category',
      data: sorted.map((i) => i.label),
      splitLine: { show: false },
      axisLabel: { color: t.text },
    },
    series: [
      {
        type: 'bar',
        name: valueName,
        data: sorted.map((i) => i.value),
        barMaxWidth: 18,
        itemStyle: { color: t.categorical[0], borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: t.textMuted,
          formatter: (p: { value: number }) => format(p.value),
        },
      },
    ],
  };
}

/** Diverging horizontal bars (e.g. net individual money flow per sector). */
export function divergingBarOption(
  items: BarItem[],
  valueName: string,
  format: (v: number) => string,
): ChartOption {
  const sorted = [...items].filter((i) => Number.isFinite(i.value)).sort((a, b) => a.value - b.value);
  return {
    grid: { left: 16, right: 16, top: 8, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => format(v) },
    xAxis: {
      ...axis(valueName),
      type: 'value',
      axisLabel: { color: t.textMuted, formatter: (v: number) => format(v) },
    },
    yAxis: {
      ...axis(),
      type: 'category',
      data: sorted.map((i) => i.label),
      splitLine: { show: false },
      axisLabel: { color: t.text },
    },
    series: [
      {
        type: 'bar',
        name: valueName,
        barMaxWidth: 18,
        data: sorted.map((i) => ({
          value: i.value,
          itemStyle: {
            color: i.value >= 0 ? t.positive : t.negative,
            borderRadius: i.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
        })),
      },
    ],
  };
}
