import { h } from '../dom';
import { fa } from '../../i18n/fa';
import type { Dataset } from '../../core/types';
import { gradeOf } from '../../core/scoring/grades';
import { scoringConfig } from '../../config/scoring';
import { chartTheme } from '../../config/theme';
import { allFlags } from '../../config/allFlags';
import { fv } from '../format';

/** Score number + grade letter (color is never the only carrier of meaning). */
export function scoreBadge(
  score: number | null | undefined,
  emptyText: string = fa.score.insufficient,
): HTMLElement {
  const s = score ?? NaN;
  const g = gradeOf(s, scoringConfig);
  if (!g) return h('span', { class: 'badge score-badge g-none', text: emptyText });
  return h(
    'span',
    { class: `badge score-badge g-${g.grade}`, attrs: { title: g.label } },
    `${fv(s, 'score')} ${g.grade}`,
  );
}

/** Row of small cells, one per factor, colored by grade; title shows label and value. */
export function factorBar(values: Array<number | null>, labels: string[]): HTMLElement {
  return h(
    'span',
    {
      class: 'factor-bar',
      attrs: {
        role: 'img',
        'aria-label': labels.map((l, k) => `${l}: ${fv(values[k] ?? NaN, 'score')}`).join('، '),
      },
    },
    values.map((v, k) => {
      const g = gradeOf(v ?? NaN, scoringConfig);
      return h('i', {
        attrs: { title: `${labels[k]}: ${fv(v ?? NaN, 'score')}` },
        style: g ? `background:${chartTheme.grades[g.grade]};height:${6 + ((v ?? 0) / 100) * 12}px` : '',
      });
    }),
  );
}

const flagIndex = new Map(allFlags.map((f) => [f.id, f]));

/** Ids of the flags that are on for row i. */
export function activeFlags(ds: Dataset, i: number, only?: string[]): string[] {
  return (only ?? allFlags.map((f) => f.id)).filter((id) => ds.num[`flag.${id}`]?.[i] === 1);
}

export function flagChips(ids: string[]): HTMLElement {
  return h(
    'span',
    { class: 'row', style: 'gap:4px;flex-wrap:wrap' },
    ids.map((id) => {
      const f = flagIndex.get(id);
      const tone = f?.tone === 'good' ? 'good' : f?.tone === 'bad' ? 'bad' : '';
      const mark = f?.tone === 'good' ? '▲' : f?.tone === 'bad' ? '▼' : '●';
      return h(
        'span',
        { class: `badge flag-chip ${tone}`, attrs: { title: f?.description ?? id } },
        `${mark} ${f?.label ?? id}`,
      );
    }),
  );
}

export function confidenceText(conf: number | undefined): HTMLElement {
  const v = conf ?? NaN;
  const cls = v < 0.6 ? 'num warn' : 'num muted';
  return h('bdi', { class: cls, text: fv(v, 'percent').replace(/[٫.]\d+٪/, '٪') });
}

/** Signed delta with an arrow (▲/▼) and color. */
export function deltaText(d: number | undefined | null): HTMLElement {
  if (d === null || d === undefined || !Number.isFinite(d)) return h('span', { class: 'faint', text: '—' });
  const cls = d > 0 ? 'pos' : d < 0 ? 'neg' : 'muted';
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '•';
  return h('bdi', { class: `num ${cls}`, text: `${arrow} ${fv(Math.abs(d), 'score')}` });
}
