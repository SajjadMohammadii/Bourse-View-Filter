import { h, replace } from '../dom';
import { fa } from '../../i18n/fa';
import type { Page, PageContext } from '../page';
import { createDataPage } from './data-page';
import { DataTable, columnFromMeta, datasetRows, type TableColumn } from '../components/data-table';
import { categorySelect, fieldSelect } from '../components/field-select';
import type { Dataset } from '../../core/types';
import { formatNumber } from '../../core/utils/format';
import { exportRows } from '../../app/services/exportService';

const t = fa.raw;
const DEFAULT_COLUMNS = [
  'Symbol',
  'Company',
  'Exchange',
  'Sector',
  'Industry',
  'Price',
  'DailyChange',
  'MarketCap',
  'PtoE_ttm',
  'PtoB',
  'ROE',
  'NPMargin',
  'Ret_1M',
  'RSI',
  'AvgVal_20D',
];

export function createRawDataPage(ctx: PageContext): Page {
  return createDataPage(
    ctx,
    t.title,
    (body, ds, state) => {
      let columns = DEFAULT_COLUMNS.filter((c) => ds.meta[c]);
      const chips = h('div', { class: 'row' });
      const counter = h('span', { class: 'muted' });
      const search = h('input', { class: 'input', attrs: { type: 'search', placeholder: t.searchSymbol } });
      const tableHost = h('div');
      const addField = fieldSelect(ds, { placeholder: t.addColumn, filter: (m) => !columns.includes(m.id) });
      const addCat = categorySelect(ds, t.addCategory);
      const reset = h('button', { class: 'btn sm', text: t.reset });
      const exportBtn = h('button', { class: 'btn sm', text: fa.studio.exportXlsx });
      const exportCsv = h('button', { class: 'btn sm', text: fa.app.exportCsv });

      body.append(
        h('div', { class: 'page-head' }, h('h1', { class: 'grow', text: t.title }), counter),
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'row' }, search, addField, addCat, reset, exportBtn, exportCsv),
          h('div', { style: 'margin-block-start:8px' }, chips),
        ),
        tableHost,
      );

      const visible = (): number[] => {
        const q = search.value.trim();
        if (!q) return state.visible;
        const company = ds.text['Company'] ?? [];
        return state.visible.filter((i) => ds.symbols[i]?.includes(q) || company[i]?.includes(q));
      };
      const table = new DataTable(tableHost, {
        columns: tableColumns(ds, columns),
        rows: datasetRows(ds, columns, state.visible),
        height: 'calc(100vh - 340px)',
        initialSort: { column: 'MarketCap', dir: 'desc' },
        onRowClick: (r) => ctx.app.select(String(r['Symbol'] ?? '')),
      });
      const refreshRows = () => {
        const idx = visible();
        table.setData(datasetRows(ds, columns, idx));
        counter.textContent = `${t.shown} ${formatNumber(idx.length, 0)} ${t.of} ${formatNumber(ds.size, 0)}`;
      };
      const refreshColumns = () => {
        table.setColumns(tableColumns(ds, columns));
        refreshRows();
        renderChips();
      };
      const renderChips = () =>
        replace(
          chips,
          columns.map((id) =>
            h('button', {
              class: 'chip',
              text: `${ds.meta[id]?.label ?? id} ✕`,
              attrs: { title: `${fa.app.remove} ${id}` },
              on: {
                click: () => {
                  columns = columns.filter((c) => c !== id);
                  refreshColumns();
                },
              },
            }),
          ),
        );

      addField.addEventListener('change', () => {
        if (addField.value) columns = [...columns, addField.value];
        addField.value = '';
        refreshColumns();
      });
      addCat.addEventListener('change', () => {
        const ids = Object.values(ds.meta)
          .filter((m) => m.category === addCat.value)
          .map((m) => m.id);
        columns = [...new Set([...columns, ...ids])];
        addCat.value = '';
        refreshColumns();
      });
      reset.addEventListener('click', () => {
        columns = DEFAULT_COLUMNS.filter((c) => ds.meta[c]);
        refreshColumns();
      });
      search.addEventListener('input', refreshRows);
      const exportAs = (format: 'xlsx' | 'csv') =>
        exportRows(ds, visible(), columns, `${ds.fileName.replace(/\.\w+$/, '')}-raw`, format);
      exportBtn.addEventListener('click', () => exportAs('xlsx'));
      exportCsv.addEventListener('click', () => exportAs('csv'));
      renderChips();
      refreshRows();
      return () => table.destroy();
    },
    { filters: true },
  );
}

function tableColumns(ds: Dataset, ids: string[]): TableColumn[] {
  return ids.map((id) => columnFromMeta(ds, id, id === 'Symbol' ? {} : {}));
}
