import { h } from '../dom';

export interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'pos' | 'neg' | 'warn' | '';
  title?: string;
}

export function kpiCard({ label, value, sub, tone = '', title }: KpiProps): HTMLElement {
  return h(
    'div',
    { class: 'kpi', attrs: { title } },
    h('span', { class: 'kpi-label', text: label }),
    h('bdi', { class: `kpi-value ${tone}`, text: value }),
    sub ? h('span', { class: 'kpi-sub', text: sub }) : null,
  );
}
