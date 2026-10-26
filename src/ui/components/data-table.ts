import { TabulatorFull as Tabulator, type ColumnDefinition, type CellComponent } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import '../styles/table.css';
import type { Dataset, Unit } from '../../core/types';
import { formatByUnit, type FormatOptions, defaultFormatOptions } from '../../core/utils/format';
import { h } from '../dom';

export type TableRow = Record<string, string | number | null> & { __i: number };

export interface TableColumn {
  id: string;
  title: string;
  unit?: Unit;
  kind?: 'num' | 'text';
  frozen?: boolean;
  width?: number;
  tooltip?: string;
  /** Custom cell renderer; receives the raw value and the row. */
  render?: (value: unknown, row: TableRow) => HTMLElement | string;
}

export interface DataTableOptions {
  columns: TableColumn[];
  rows: TableRow[];
  height?: string;
  placeholder?: string;
  format?: FormatOptions;
  initialSort?: { column: string; dir: 'asc' | 'desc' };
  ariaLabel?: string;
  onRowClick?: (row: TableRow) => void;
}

/** Tabulator wrapper: RTL, virtual rendering, unit-aware number formatting. */
export class DataTable {
  private table: Tabulator;
  private ready = false;
  private queued: (() => void) | null = null;

  constructor(
    el: HTMLElement,
    private opts: DataTableOptions,
  ) {
    el.classList.add('data-table');
    this.table = new Tabulator(el, {
      data: opts.rows,
      columns: opts.columns.map((c) => this.toColumn(c)),
      height: opts.height ?? '560px',
      layout: 'fitData',
      // Field ids such as "score.technical" contain dots; they are flat keys, not nested paths.
      nestedFieldSeparator: false,
      textDirection: 'rtl',
      renderHorizontal: 'virtual',
      movableColumns: true,
      placeholder: opts.placeholder ?? '—',
      index: '__i',
      initialSort: opts.initialSort ? [opts.initialSort] : [],
    });
    this.table.on('tableBuilt', () => {
      this.fixAria(el);
      this.ready = true;
      this.queued?.();
      this.queued = null;
    });
    if (opts.onRowClick) {
      const cb = opts.onRowClick;
      this.table.on('rowClick', (_e, row) => cb(row.getData() as TableRow));
    }
  }

  /**
   * Tabulator puts a focusable, role-less scroll holder between role="grid" and its row group,
   * which breaks the ARIA grid structure; make the holder the row group instead.
   */
  private fixAria(el: HTMLElement): void {
    el.setAttribute('aria-label', this.opts.ariaLabel ?? '');
    el.querySelector('.tabulator-tableholder')?.setAttribute('role', 'rowgroup');
    el.querySelector('.tabulator-table')?.removeAttribute('role');
  }

  setData(rows: TableRow[]): void {
    this.whenReady(() => void this.table.replaceData(rows).then(() => this.fixAria(this.table.element)));
  }

  setColumns(columns: TableColumn[]): void {
    this.opts = { ...this.opts, columns };
    this.whenReady(() => this.table.setColumns(columns.map((c) => this.toColumn(c))));
  }

  download(kind: 'csv', fileName: string): void {
    this.table.download(kind, fileName, { bom: true });
  }

  destroy(): void {
    this.table.destroy();
  }

  private whenReady(fn: () => void): void {
    if (this.ready) fn();
    else this.queued = fn;
  }

  private toColumn(c: TableColumn): ColumnDefinition {
    const fmt = this.opts.format ?? defaultFormatOptions;
    const numeric = c.kind !== 'text';
    return {
      title: c.title,
      field: c.id,
      frozen: c.frozen ?? false,
      width: c.width,
      headerTooltip: c.tooltip ?? c.title,
      sorter: numeric ? 'number' : 'string',
      sorterParams: numeric ? { alignEmptyValues: 'bottom' } : {},
      hozAlign: numeric ? 'left' : 'right',
      formatter: (cell: CellComponent) => renderCell(c, cell, fmt),
    };
  }
}

function renderCell(c: TableColumn, cell: CellComponent, fmt: FormatOptions): HTMLElement | string {
  const value = cell.getValue() as unknown;
  if (c.render) return c.render(value, cell.getRow().getData() as TableRow);
  if (c.kind === 'text') return h('span', { text: value == null ? '' : String(value) });
  const n = typeof value === 'number' ? value : NaN;
  const cls = n < 0 ? 'num neg' : 'num';
  return h('bdi', { class: cls, text: formatByUnit(n, c.unit ?? 'number', fmt) });
}

/** Builds plain row objects for the given fields; NaN becomes null so sorting puts it last. */
export function datasetRows(ds: Dataset, fields: string[], indices?: ArrayLike<number>): TableRow[] {
  const idx = indices ?? Array.from({ length: ds.size }, (_, i) => i);
  const rows: TableRow[] = [];
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k] as number;
    const row: TableRow = { __i: i };
    for (const f of fields) {
      const num = ds.num[f];
      if (num) {
        const v = num[i] as number;
        row[f] = Number.isNaN(v) ? null : v;
      } else row[f] = ds.text[f]?.[i] ?? null;
    }
    rows.push(row);
  }
  return rows;
}

/** Column definition derived from dataset metadata. */
export function columnFromMeta(ds: Dataset, id: string, extra: Partial<TableColumn> = {}): TableColumn {
  const m = ds.meta[id];
  const tooltip = m?.description ? `${m.label} (${id})\n${m.description}` : `${m?.label ?? id} (${id})`;
  return { id, title: m?.label ?? id, unit: m?.unit, kind: m?.kind ?? 'num', tooltip, ...extra };
}
