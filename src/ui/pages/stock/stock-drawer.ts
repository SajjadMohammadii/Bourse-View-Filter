import { append, h, replace } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { App } from '../../../app/appState';
import type { Dataset } from '../../../core/types';
import { median } from '../../../core/utils/stats';
import { profiles } from '../../../config/profiles';
import { exchangeLabels } from '../../../config/columns';
import { activeFlags, flagChips, scoreBadge } from '../../components/score';
import { ChartBag, card, groupIndices } from '../page-helpers';
import { radarOption } from '../../charts/radar';
import { factorDetails } from './factor-details';
import { levelTrack } from './levels';
import { scoreHistoryCard } from './score-history';
import { fv } from '../../format';

const MAX_COMPARE = 4;

/** Side drawer with everything about one symbol (PLAN.md §12.3-د). */
export class StockDrawer {
  private readonly backdrop = h('div', { class: 'drawer-backdrop', attrs: { hidden: true } });
  private readonly panel = h('aside', {
    class: 'drawer',
    attrs: { hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': fa.stock.open },
  });
  private bag = new ChartBag();
  private compare: string[] = [];
  private lastFocus: Element | null = null;

  constructor(private readonly app: App) {
    this.backdrop.addEventListener('click', () => app.select(null));
    this.panel.addEventListener('keydown', (e) => e.key === 'Escape' && app.select(null));
    app.store.subscribe((s, prev) => {
      if (s.selected !== prev.selected || (s.selected && s.dataset !== prev.dataset)) this.render();
    });
  }

  mount(root: HTMLElement): void {
    root.append(this.backdrop, this.panel);
  }

  private render(): void {
    const { selected, dataset } = this.app.store.get();
    this.bag.dispose();
    const i = selected && dataset ? dataset.symbols.indexOf(selected) : -1;
    const open = i >= 0 && !!dataset;
    this.backdrop.hidden = !open;
    this.panel.hidden = !open;
    if (!open || !dataset) {
      if (this.lastFocus instanceof HTMLElement) this.lastFocus.focus();
      this.compare = [];
      return;
    }
    if (!this.panel.contains(document.activeElement)) this.lastFocus = document.activeElement;
    replace(this.panel);
    this.fill(dataset, i);
    this.panel.focus();
  }

  private fill(ds: Dataset, i: number): void {
    const industry = ds.text['Industry']?.[i] ?? '';
    const industryIdx =
      groupIndices(
        ds,
        Array.from({ length: ds.size }, (_, k) => k),
        'Industry',
      ).get(industry) ?? [];
    const close = h('button', {
      class: 'btn ghost',
      text: '✕',
      attrs: { 'aria-label': fa.app.close },
      on: { click: () => this.app.select(null) },
    });
    this.panel.setAttribute('tabindex', '-1');
    const levels = levelTrack(ds, i);
    append(this.panel, [
      h(
        'div',
        { class: 'page-head' },
        h(
          'div',
          { class: 'grow' },
          h('h1', { text: ds.symbols[i] ?? '' }),
          h('p', { class: 'muted', text: subtitle(ds, i) }),
        ),
        close,
      ),
      facts(ds, i),
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'muted', text: fa.score.composite }),
        scoreBadge(ds.num['score.composite']?.[i]),
        flagChips(activeFlags(ds, i)),
      ),
      h(
        'div',
        { class: 'grid grid-2' },
        profiles.map((p) => this.radar(ds, p.id, i, industryIdx)),
      ),
      profiles.map((p) => factorDetails(ds, p, i, industryIdx)),
      levels ? card(fa.stock.levels, levels) : null,
      scoreHistoryCard(this.app, this.bag, ds.symbols[i] ?? ''),
      this.compareCard(ds, i),
    ]);
  }

  private radar(ds: Dataset, profileId: string, i: number, industryIdx: number[]): HTMLElement {
    const p = profiles.find((x) => x.id === profileId);
    if (!p) return h('div');
    const own = p.factors.map((f) => ds.num[`factor.${p.id}.${f.id}`]?.[i] ?? null);
    const med = p.factors.map((f) => {
      const col = ds.num[`factor.${p.id}.${f.id}`];
      const v = median(industryIdx.map((k) => col?.[k] ?? NaN).filter(Number.isFinite));
      return Number.isFinite(v) ? v : null;
    });
    const summary = `${p.label}: ${p.factors.map((f, k) => `${f.label} ${fv(own[k] ?? NaN, 'score')}`).join('، ')}`;
    return this.bag.card(
      p.label,
      radarOption(
        p.factors.map((f) => f.id),
        [
          { name: ds.symbols[i] ?? '', values: own },
          { name: fa.stock.vsIndustry, values: med, reference: true },
        ],
      ),
      summary,
      { size: 'short', head: scoreBadge(ds.num[`score.${p.id}`]?.[i], p.ineligibleLabel) },
    );
  }

  private compareCard(ds: Dataset, i: number): HTMLElement {
    const host = h('div');
    const listId = 'bv-compare-symbols';
    const input = h('input', {
      class: 'input',
      attrs: { list: listId, placeholder: fa.stock.compareHint, 'aria-label': fa.stock.compare },
    });
    const datalist = h(
      'datalist',
      { attrs: { id: listId } },
      ds.symbols.map((s) => h('option', { attrs: { value: s } })),
    );
    const draw = () => {
      const symbols = [ds.symbols[i] ?? '', ...this.compare];
      const indicators = [...profiles.map((p) => p.label), fa.score.composite];
      const series = symbols.map((s) => {
        const k = ds.symbols.indexOf(s);
        return {
          name: s,
          values: [
            ...profiles.map((p) => ds.num[`score.${p.id}`]?.[k] ?? null),
            ds.num['score.composite']?.[k] ?? null,
          ],
        };
      });
      replace(
        host,
        this.bag.card(
          fa.stock.compare,
          radarOption(indicators, series),
          `${fa.stock.compare}: ${symbols.join('، ')}`,
        ),
      );
    };
    input.addEventListener('change', () => {
      const s = input.value.trim();
      if (ds.symbols.includes(s) && !this.compare.includes(s) && this.compare.length < MAX_COMPARE - 1)
        this.compare.push(s);
      input.value = '';
      draw();
    });
    draw();
    return h(
      'div',
      {},
      h('div', { class: 'row' }, h('b', { text: fa.stock.compare }), input, datalist),
      host,
    );
  }
}

function subtitle(ds: Dataset, i: number): string {
  const ex = ds.text['Exchange']?.[i] ?? '';
  return [ds.text['Company']?.[i], exchangeLabels[ex] ?? ex, ds.text['Sector']?.[i], ds.text['Industry']?.[i]]
    .filter(Boolean)
    .join(' · ');
}

function facts(ds: Dataset, i: number): HTMLElement {
  const n = (id: string) => ds.num[id]?.[i] ?? NaN;
  const change = n('DailyChange');
  const fact = (label: string, value: HTMLElement | string) =>
    h(
      'div',
      { class: 'kpi' },
      h('span', { class: 'kpi-label', text: label }),
      typeof value === 'string' ? h('bdi', { class: 'kpi-value', text: value }) : value,
    );
  return h(
    'div',
    { class: 'grid grid-kpi' },
    fact(fa.stock.price, fv(n('Price'), 'price')),
    fact(
      fa.stock.change,
      h('bdi', {
        class: `kpi-value ${change > 0 ? 'pos' : change < 0 ? 'neg' : ''}`,
        text: `${change > 0 ? '▲' : change < 0 ? '▼' : ''} ${fv(change, 'percent')}`,
      }),
    ),
    fact(fa.stock.mcap, fv(n('MarketCap'), 'rial')),
    fact(fa.stock.statementAge, fv(n('D_StatementAgeDays'), 'days')),
    fact(fa.stock.piotroski, `${fv(n('D_PiotroskiLite'), 'rank')} / ۷`),
  );
}
