import { chartTheme as t } from '../../config/theme';
import type { ChartOption } from './echarts';

export interface RadarSeries {
  name: string;
  values: Array<number | null>;
  /** Reference layers (e.g. industry median) are drawn faint and dashed. */
  reference?: boolean;
}

export function radarOption(indicators: string[], series: RadarSeries[]): ChartOption {
  return {
    legend: series.length > 1 ? { bottom: 0, textStyle: { color: t.textMuted } } : undefined,
    tooltip: { trigger: 'item' },
    radar: {
      indicator: indicators.map((name) => ({ name, max: 100 })),
      radius: '62%',
      center: ['50%', '48%'],
      axisName: { color: t.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: t.grid } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: t.grid } },
    },
    series: [
      {
        type: 'radar',
        symbolSize: 5,
        data: series.map((s, k) => {
          const color = s.reference ? t.textFaint : t.categorical[k % t.categorical.length];
          return {
            name: s.name,
            value: s.values.map((v) => (v === null || !Number.isFinite(v) ? 0 : v)),
            lineStyle: { color, width: 2, type: s.reference ? 'dashed' : 'solid' },
            itemStyle: { color },
            areaStyle: s.reference ? undefined : { color, opacity: 0.15 },
          };
        }),
      },
    ],
  };
}
