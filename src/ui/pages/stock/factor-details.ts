import { h } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { Dataset } from '../../../core/types';
import type { ProfileDef } from '../../../core/scoring/types';
import { percentileOf } from '../../../core/utils/stats';
import { scoreBadge } from '../../components/score';
import { fv } from '../../format';

/** Expandable factor → metric breakdown with raw value, market and industry percentiles (PLAN.md §12.3-د). */
export function factorDetails(ds: Dataset, p: ProfileDef, i: number, industryIdx: number[]): HTMLElement {
  return h(
    'details',
    { class: 'card' },
    h(
      'summary',
      { class: 'row', style: 'cursor:pointer' },
      h('b', { text: p.label }),
      scoreBadge(ds.num[`score.${p.id}`]?.[i], p.ineligibleLabel),
    ),
    p.factors.map((f) =>
      h(
        'details',
        { class: 'factor' },
        h(
          'summary',
          {},
          h('span', { class: 'grow', text: `${f.id} ${f.label}` }),
          scoreBadge(ds.num[`factor.${p.id}.${f.id}`]?.[i]),
        ),
        h('p', { class: 'faint', text: f.description }),
        metricTable(
          ds,
          f.metrics.map((m) => m.metric),
          i,
          industryIdx,
        ),
      ),
    ),
  );
}

function metricTable(ds: Dataset, metrics: string[], i: number, industryIdx: number[]): HTMLElement {
  return h(
    'table',
    { class: 'simple-table metric-table' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        [fa.stock.metric, fa.stock.raw, fa.stock.pctMarket, fa.stock.pctIndustry].map((t) =>
          h('th', { text: t }),
        ),
      ),
    ),
    h(
      'tbody',
      {},
      metrics.map((id) => {
        const meta = ds.meta[id];
        const col = ds.num[id];
        const v = col?.[i] ?? NaN;
        const pm = col ? percentileOf(col, v) : NaN;
        const pi = col ? percentileOf(col, v, industryIdx) : NaN;
        return h(
          'tr',
          {},
          h(
            'td',
            { attrs: { title: `${id}\n${meta?.description ?? ''}` } },
            meta?.label ?? id,
            h('div', { class: 'faint mono', text: id }),
          ),
          h('td', {}, h('bdi', { class: 'num', text: fv(v, meta?.unit ?? 'number') })),
          h('td', {}, meter(pm)),
          h('td', {}, meter(pi)),
        );
      }),
    ),
  );
}

function meter(p: number): HTMLElement {
  return h(
    'div',
    { class: 'row', style: 'flex-wrap:nowrap' },
    h(
      'div',
      { class: 'meter', style: 'width:60px' },
      h('i', { style: `width:${Number.isFinite(p) ? p : 0}%` }),
    ),
    h('bdi', { class: 'num faint', text: fv(p, 'rank') }),
  );
}
