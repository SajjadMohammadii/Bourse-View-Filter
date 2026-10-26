import * as echarts from 'echarts/core';
import {
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
} from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
  GraphicComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { chartTheme as t } from '../../config/theme';
import { num } from '../format';

echarts.use([
  BarChart,
  GaugeChart,
  HeatmapChart,
  LineChart,
  RadarChart,
  ScatterChart,
  TreemapChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export type ChartOption = EChartsCoreOption;

/** Shared defaults: recessive axes/grid, Vazirmatn, token colors (PLAN.md §12.1). */
export const base = {
  textStyle: { fontFamily: t.font, color: t.textMuted },
  backgroundColor: 'transparent',
  animationDuration: 300,
  tooltip: {
    backgroundColor: t.surface2,
    borderColor: t.border,
    textStyle: { color: t.text, fontFamily: t.font },
    extraCssText: 'direction: rtl; text-align: right;',
  },
};

/** Persian digits for numeric axis labels; category labels pass through. */
const axisLabelFormatter = (v: number | string) => (typeof v === 'number' ? num(v) : v);

export const axis = (name = '') => ({
  name,
  nameTextStyle: { color: t.textMuted },
  axisLine: { lineStyle: { color: t.border } },
  axisTick: { show: false },
  axisLabel: { color: t.textMuted, formatter: axisLabelFormatter },
  splitLine: { lineStyle: { color: t.grid } },
});

/** ECharts instance bound to a host element; resizes with it and disposes on demand. */
export class Chart {
  private readonly instance: echarts.ECharts;
  private readonly observer: ResizeObserver;
  private clickHandler: ((name: string) => void) | null = null;

  constructor(
    readonly host: HTMLElement,
    ariaLabel: string,
  ) {
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', ariaLabel);
    this.instance = echarts.init(host, undefined, { renderer: 'canvas' });
    this.observer = new ResizeObserver(() => this.instance.resize());
    this.observer.observe(host);
    this.instance.on('click', (p) => {
      const params = p as { name?: string; data?: { name?: string } };
      const name = params.data?.name ?? params.name;
      if (name && this.clickHandler) this.clickHandler(name);
    });
  }

  set(option: ChartOption, summary?: string): void {
    this.instance.setOption({ ...base, ...option }, { notMerge: true });
    if (summary) this.host.setAttribute('aria-label', summary);
  }

  /** Called with the data item's name (a symbol for most charts). */
  onClick(fn: (name: string) => void): void {
    this.clickHandler = fn;
  }

  dispose(): void {
    this.observer.disconnect();
    this.instance.dispose();
  }
}
