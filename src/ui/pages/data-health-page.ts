import { h } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page, PageContext } from '../page';
import { createDataPage } from './data-page';
import { kpiCard } from '../components/kpi';
import { DataTable, type TableColumn, type TableRow } from '../components/data-table';
import type { DataHealthReport } from '../../core/types';
import { categoryLabels } from '../../config/columns';
import { formatNumber, formatPercent } from '../../core/utils/format';
import type { HistoryDiff } from '../../core/history/diff';

const t = fa.health;
const n = (v: number): string => formatNumber(v, 0);

export function createDataHealthPage(ctx: PageContext): Page {
  return createDataPage(ctx, t.title, (body, _ds, state) => {
    const report = state.report;
    if (!report) return;
    body.append(
      h('h1', { text: t.title }),
      kpis(report),
      historyDiffCard(state.historyDiff, state.history.length),
      issues(report),
    );
    const tableHost = h('div');
    const search = h('input', { class: 'input', attrs: { type: 'search', placeholder: fa.app.search } });
    body.append(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { text: t.coverage }), search),
        h('p', { class: 'muted', text: t.coverageHint }),
        tableHost,
      ),
      h('p', { class: 'faint', text: `${t.timings}: ${timingText(state.timings)}` }),
    );
    const rows = coverageRows(report);
    const table = new DataTable(tableHost, { columns: coverageColumns(), rows, height: '520px' });
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      table.setData(q ? rows.filter((r) => `${r.id} ${r.label}`.toLowerCase().includes(q)) : rows);
    });
    return () => table.destroy();
  });
}

function kpis(r: DataHealthReport): HTMLElement {
  const tone = (v: number) => (v > 0 ? 'warn' : '');
  return h(
    'div',
    { class: 'grid grid-kpi' },
    kpiCard({ label: t.rows, value: n(r.rowCount) }),
    kpiCard({ label: t.columns, value: n(r.columnCount) }),
    kpiCard({ label: t.dropped, value: n(r.droppedColumns.length) }),
    kpiCard({ label: t.unknown, value: n(r.unknownColumns.length), tone: tone(r.unknownColumns.length) }),
    kpiCard({
      label: t.missingRequired,
      value: n(r.missingRequired.length),
      tone: r.missingRequired.length ? 'neg' : '',
    }),
    kpiCard({
      label: t.duplicates,
      value: n(r.duplicateSymbols.length),
      tone: tone(r.duplicateSymbols.length),
    }),
    kpiCard({ label: t.noSector, value: n(r.noSectorSymbols.length), tone: tone(r.noSectorSymbols.length) }),
    kpiCard({ label: t.nonNumeric, value: n(r.nonNumericCells), tone: tone(r.nonNumericCells) }),
  );
}

function issues(r: DataHealthReport): HTMLElement {
  const lists: Array<[string, string[]]> = [
    [t.warnings, r.warnings],
    [t.missingRequired, r.missingRequired],
    [t.unknown, r.unknownColumns],
    [t.missing, r.missingColumns],
    [t.duplicates, r.duplicateSymbols],
    [t.noSector, r.noSectorSymbols],
    [t.renamed, r.renamedColumns.map((x) => `${JSON.stringify(x.from)} → ${x.to}`)],
    [t.implausible, r.implausible.map((x) => `${x.symbol}: ${x.column} = ${x.value} (${x.reason})`)],
    [t.dropped, r.droppedColumns],
  ];
  const nonEmpty = lists.filter(([, items]) => items.length > 0);
  if (!nonEmpty.length) return h('div', { class: 'ok-box', text: t.allGood });
  return h(
    'div',
    { class: 'grid grid-3' },
    nonEmpty.map(([title, items]) =>
      h(
        'section',
        { class: 'card' },
        h('h3', { text: `${title} (${n(items.length)})` }),
        h(
          'ul',
          {
            class: 'mono',
            // Scrollable list must be keyboard-reachable (WCAG 2.1.1).
            attrs: { tabindex: 0, 'aria-label': title },
            style: 'max-height:180px;overflow:auto;margin:0;padding-inline-start:18px',
          },
          items.slice(0, 200).map((x) => h('li', { text: x })),
        ),
      ),
    ),
  );
}

function coverageRows(r: DataHealthReport): TableRow[] {
  return r.coverage.map((c, i) => ({
    __i: i,
    id: c.id,
    label: c.label,
    category: categoryLabels[c.category],
    kind: c.kind === 'num' ? t.kindNum : t.kindText,
    filled: c.filled,
    coverage: c.coverage,
    nonNumeric: c.nonNumericCells,
  }));
}

function coverageColumns(): TableColumn[] {
  return [
    { id: 'id', title: t.colId, kind: 'text', render: (v) => h('code', { text: String(v) }) },
    { id: 'label', title: t.colLabel, kind: 'text' },
    { id: 'category', title: t.colCategory, kind: 'text' },
    { id: 'kind', title: t.colKind, kind: 'text' },
    { id: 'filled', title: t.colFilled, unit: 'rank' },
    { id: 'coverage', title: t.colCoverage, render: (v) => coverageMeter(Number(v)) },
    { id: 'nonNumeric', title: t.colNonNumeric, unit: 'rank' },
  ];
}

function coverageMeter(v: number): HTMLElement {
  const color = v >= 0.8 ? 'var(--turquoise-500)' : v >= 0.4 ? 'var(--blue-500)' : 'var(--warning)';
  return h(
    'div',
    { class: 'row', style: 'flex-wrap:nowrap' },
    h(
      'div',
      { class: 'meter', style: 'width:90px' },
      h('i', { style: `width:${v * 100}%;background:${color}` }),
    ),
    h('bdi', { class: 'num', text: formatPercent(v, 0) }),
  );
}

function timingText(timings: Record<string, number>): string {
  return Object.entries(timings)
    .map(([k, v]) => `${k} ${formatNumber(v, 0)}ms`)
    .join(' · ');
}

/** New/removed symbols and columns versus the previous stored snapshot (PLAN.md §12.3-ز). */
function historyDiffCard(diff: HistoryDiff | null, stored: number): HTMLElement {
  const head = h(
    'div',
    { class: 'card-head' },
    h('h2', { text: fa.history.diffTitle }),
    h('span', { class: 'muted', text: fa.history.count(stored) }),
  );
  if (!diff)
    return h('section', { class: 'card' }, head, h('p', { class: 'faint', text: fa.history.noPrevious }));
  const list = (title: string, items: string[]) =>
    h(
      'div',
      {},
      h('h3', { text: `${title} (${n(items.length)})` }),
      items.length
        ? h(
            'div',
            { class: 'row' },
            items.slice(0, 60).map((x) => h('span', { class: 'badge flag-chip', text: x })),
          )
        : h('p', { class: 'faint', text: fa.history.none }),
    );
  return h(
    'section',
    { class: 'card' },
    head,
    h(
      'p',
      { class: 'muted' },
      `${fa.history.previous}: `,
      h('bdi', { class: 'num', text: diff.previousKey }),
    ),
    h(
      'div',
      { class: 'grid grid-2' },
      list(fa.history.newSymbols, diff.newSymbols),
      list(fa.history.removedSymbols, diff.removedSymbols),
      list(fa.history.newColumns, diff.newColumns),
      list(fa.history.removedColumns, diff.removedColumns),
    ),
  );
}
