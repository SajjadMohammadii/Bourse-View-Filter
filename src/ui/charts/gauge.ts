import { chartTheme as t } from '../../config/theme';
import type { MarketRegime } from '../../core/market/types';
import type { ChartOption } from './echarts';
import { num } from '../format';

/** 0–100 risk gauge with regime bands (each band labeled in the legend card, never color alone). */
export function gaugeOption(value: number | null, regimes: MarketRegime[], label: string): ChartOption {
  const stops = regimes.map((r) => [Math.min(r.max, 100) / 100, t.regimes[r.id] ?? t.other]);
  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 200,
        endAngle: -20,
        radius: '95%',
        center: ['50%', '62%'],
        axisLine: { lineStyle: { width: 16, color: stops } },
        pointer: { width: 5, length: '62%', itemStyle: { color: t.text } },
        anchor: { show: true, size: 10, itemStyle: { color: t.text } },
        axisTick: { show: false },
        splitLine: { length: 16, lineStyle: { color: t.surface, width: 2 } },
        axisLabel: {
          color: t.textMuted,
          distance: 22,
          fontSize: 11,
          formatter: (v: number) => num(v, 0),
        },
        title: { show: true, offsetCenter: [0, '58%'], color: t.textMuted, fontSize: 14 },
        detail: {
          valueAnimation: true,
          // Below the needle hub so the value never sits under the pointer.
          offsetCenter: [0, '34%'],
          color: t.text,
          fontSize: 30,
          fontWeight: 700,
          formatter: (v: number) => num(v, 0),
        },
        data: [{ value: value ?? 0, name: label }],
      },
    ],
  };
}
