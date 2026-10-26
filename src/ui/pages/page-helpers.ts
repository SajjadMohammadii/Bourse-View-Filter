import { h, type Child } from '../dom';
import { Chart, type ChartOption } from '../charts/echarts';
import type { Dataset } from '../../core/types';
import { quantile } from '../../core/utils/stats';
import { SCATTER_MAX_GROUPS } from '../../config/theme';
import { fa } from '../../i18n/fa';

export function card(title: string | null, ...children: Child[]): HTMLElement {
  return h(
    'section',
    { class: 'card' },
    title ? h('div', { class: 'card-head' }, h('h2', { text: title })) : null,
    ...children,
  );
}

/** Collects charts created during a render so they can all be disposed together. */
export class ChartBag {
  private charts: Chart[] = [];

  /** Card with a chart; `size` maps to .chart.tall / .short. */
  card(
    title: string,
    option: ChartOption,
    summary: string,
    opts: { size?: 'tall' | 'short'; hint?: string; head?: Child; onClick?: (name: string) => void } = {},
  ): HTMLElement {
    const host = h('div', { class: `chart ${opts.size ?? ''}` });
    const el = h(
      'section',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { text: title }), opts.head ?? null),
      opts.hint ? h('p', { class: 'faint', style: 'margin-top:-4px', text: opts.hint }) : null,
      host,
    );
    // Charts need a laid-out host: initialize on the next frame.
    requestAnimationFrame(() => {
      if (!host.isConnected) return;
      const chart = new Chart(host, summary);
      chart.set(option, summary);
      if (opts.onClick) chart.onClick(opts.onClick);
      this.charts.push(chart);
    });
    return el;
  }

  dispose(): void {
    for (const c of this.charts) c.dispose();
    this.charts = [];
  }
}

/** Top-N groups by count (others fold into «سایر») — scatter color slots (dataviz rule). */
export function topGroups(ds: Dataset, indices: number[], field = 'Sector', n = SCATTER_MAX_GROUPS) {
  const values = ds.text[field] ?? [];
  const counts = new Map<string, number>();
  for (const i of indices) counts.set(values[i] ?? '', (counts.get(values[i] ?? '') ?? 0) + 1);
  const top = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
  const other = fa.overview.other;
  const groupOf = (i: number) => (top.includes(values[i] ?? '') ? (values[i] as string) : other);
  const groups = counts.size > n ? [...top, other] : top;
  return { groups, groupOf, other: counts.size > n ? other : null };
}

/** Clamp range [p2, p98] used to keep outliers from flattening scatter axes. */
export function robustRange(values: number[]): [number, number] {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? [quantile(s, 0.02), quantile(s, 0.98)] : [0, 1];
}

export const clampTo =
  ([lo, hi]: [number, number]) =>
  (v: number) =>
    Math.min(hi, Math.max(lo, v));

/** Indices sorted by a numeric field (finite values only). */
export function sortedBy(
  ds: Dataset,
  indices: number[],
  field: string,
  dir: 'desc' | 'asc' = 'desc',
): number[] {
  const col = ds.num[field];
  if (!col) return [];
  const finite = indices.filter((i) => Number.isFinite(col[i] as number));
  return finite.sort((a, b) =>
    dir === 'desc' ? (col[b] as number) - (col[a] as number) : (col[a] as number) - (col[b] as number),
  );
}

export function meanOf(ds: Dataset, indices: number[], field: string): number {
  const col = ds.num[field];
  if (!col) return NaN;
  let s = 0;
  let n = 0;
  for (const i of indices) {
    const v = col[i] as number;
    if (Number.isFinite(v)) {
      s += v;
      n++;
    }
  }
  return n ? s / n : NaN;
}

/** Group indices by a text field. */
export function groupIndices(ds: Dataset, indices: number[], field: string): Map<string, number[]> {
  const values = ds.text[field] ?? [];
  const m = new Map<string, number[]>();
  for (const i of indices) {
    const k = values[i] ?? '';
    const list = m.get(k);
    if (list) list.push(i);
    else m.set(k, [i]);
  }
  return m;
}
