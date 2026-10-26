import { h } from '../../dom';
import type { Dataset } from '../../../core/types';
import { fv } from '../../format';

/** Support/resistance levels drawn on one horizontal price track (PLAN.md §12.3-د). */
const LEVELS: Array<[string, string]> = [
  ['pp_standard_s3', 'S3'],
  ['pp_standard_s2', 'S2'],
  ['pp_standard_s1', 'S1'],
  ['pp_standard_p', 'P'],
  ['pp_standard_r1', 'R1'],
  ['pp_standard_r2', 'R2'],
  ['pp_standard_r3', 'R3'],
  ['blbands', 'BB−'],
  ['bubands', 'BB+'],
  ['SMA_20D', 'SMA20'],
  ['SMA_50D', 'SMA50'],
  ['SMA_200D', 'SMA200'],
];

export function levelTrack(ds: Dataset, i: number): HTMLElement | null {
  const price = ds.num['Price']?.[i] ?? NaN;
  const marks = LEVELS.map(([id, label]) => ({ label, value: ds.num[id]?.[i] ?? NaN })).filter((m) =>
    Number.isFinite(m.value),
  );
  if (!Number.isFinite(price) || !marks.length) return null;
  const all = [...marks.map((m) => m.value), price];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pos = (v: number) => (hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100);
  const sorted = [...marks].sort((a, b) => a.value - b.value);
  return h(
    'div',
    {
      class: 'level-track',
      attrs: {
        role: 'img',
        'aria-label': sorted.map((m) => `${m.label} ${fv(m.value, 'price')}`).join('، '),
      },
    },
    h('div', { class: 'level-line' }),
    sorted.map((m, k) =>
      h(
        'div',
        {
          class: `level-mark ${k % 2 ? 'below' : 'above'} ${m.value < price ? 'support' : 'resist'}`,
          style: `left:${pos(m.value)}%`,
        },
        h(
          'span',
          { class: 'level-label' },
          `${m.label} `,
          h('bdi', { class: 'num', text: fv(m.value, 'price') }),
        ),
      ),
    ),
    h(
      'div',
      { class: 'level-mark price', style: `left:${pos(price)}%` },
      h('span', { class: 'level-label' }, '▼ ', h('bdi', { class: 'num', text: fv(price, 'price') })),
    ),
  );
}
