import { h, replace } from '../../dom';
import { fa } from '../../../i18n/fa';
import type { App } from '../../../app/appState';
import { profiles } from '../../../config/profiles';
import { lineOption } from '../../charts/line';
import type { ChartBag } from '../page-helpers';

const FIELDS = ['score.composite', ...profiles.map((p) => `score.${p.id}`)];

/** Score history across stored snapshots (PLAN.md §12.3-د, §13); loaded on demand. */
export function scoreHistoryCard(app: App, bag: ChartBag, symbol: string): HTMLElement {
  const host = h('div', {}, h('p', { class: 'faint', text: fa.history.loading }));
  void app.history.symbolHistory(symbol, FIELDS).then((hist) => {
    if (!host.isConnected) return;
    if (hist.labels.length < 2)
      return replace(
        host,
        h('h2', { text: fa.stock.history }),
        h('p', { class: 'faint', text: fa.stock.historyEmpty }),
      );
    const names: Record<string, string> = {
      'score.composite': fa.score.composite,
      ...Object.fromEntries(profiles.map((p) => [`score.${p.id}`, p.label])),
    };
    replace(
      host,
      bag.card(
        fa.stock.history,
        lineOption(
          hist.labels,
          FIELDS.map((f) => ({ name: names[f] ?? f, values: hist.series[f] ?? [] })),
          '',
          { min: 0, max: 100 },
        ),
        `${fa.stock.history}: ${symbol}`,
        { size: 'short' },
      ),
    );
  });
  return h('section', { class: 'card' }, host);
}
