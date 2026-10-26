import { h } from '../dom';
import { fa } from '../../i18n/fa';
import type { FieldSummary } from '../../core/utils/fieldSummary';
import type { Unit } from '../../core/types';
import { fv } from '../format';

const SVG = 'http://www.w3.org/2000/svg';

/** Tiny inline distribution + min/median/max/coverage for a numeric field. */
export function miniHistogram(s: FieldSummary, unit: Unit): HTMLElement {
  const max = Math.max(1, ...s.bins);
  const w = 160;
  const hgt = 32;
  const bw = w / s.bins.length;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(hgt));
  svg.setAttribute('aria-hidden', 'true');
  s.bins.forEach((c, k) => {
    const r = document.createElementNS(SVG, 'rect');
    const bh = (c / max) * (hgt - 2);
    r.setAttribute('x', String(k * bw + 0.5));
    r.setAttribute('y', String(hgt - bh));
    r.setAttribute('width', String(Math.max(1, bw - 1.5)));
    r.setAttribute('height', String(bh));
    r.setAttribute('rx', '1');
    r.setAttribute('fill', 'var(--blue-500)');
    svg.appendChild(r);
  });
  return h(
    'span',
    { class: 'row mini-hist', style: 'gap:10px' },
    svg as unknown as HTMLElement,
    h(
      'span',
      { class: 'faint', style: 'font-size:0.8rem' },
      `${fa.builder.min} `,
      h('bdi', { class: 'num', text: fv(s.min, unit) }),
      ` · ${fa.builder.median} `,
      h('bdi', { class: 'num', text: fv(s.median, unit) }),
      ` · ${fa.builder.max} `,
      h('bdi', { class: 'num', text: fv(s.max, unit) }),
      ` · ${fa.builder.coverage} `,
      h('bdi', { class: 'num', text: fv(s.coverage, 'percent') }),
    ),
  );
}
