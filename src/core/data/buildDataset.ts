import type { ColumnDef, Dataset, FieldMeta, JalaliDate, Result } from '../types';
import { err, ok } from '../types';
import { parseCell } from './parseValue';
import { planHeaders, type HeaderPlan } from './normalizeHeaders';

export interface DictionaryView {
  get(id: string): ColumnDef | undefined;
  textColumns: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  unknownTextFallback: string;
}

export interface BuildStats {
  plan: HeaderPlan;
  nonNumericByColumn: Map<string, number>;
  duplicateSymbols: string[];
  emptySymbolRows: number;
}

export interface BuildOutput {
  dataset: Dataset;
  stats: BuildStats;
}

const SYMBOL = 'Symbol';
/** Group columns where an empty value is replaced by "unknown" so grouping never breaks. */
const GROUP_COLUMNS = new Set(['Sector', 'Industry', 'Exchange']);

/** rows[0] is the header row (PLAN.md §4 steps 2–5). */
export function buildDataset(
  rows: unknown[][],
  fileName: string,
  snapshotDate: JalaliDate | null,
  dict: DictionaryView,
): Result<BuildOutput> {
  const header = rows[0] ?? [];
  const body = rows.slice(1).filter((r) => r.some((c) => parseCell(c).kind !== 'null'));
  const plan = planHeaders(header, (i) => body.every((r) => parseCell(r[i]).kind === 'null'));
  const columns = plan.columns.filter((c) => !dict.ignored.has(c.id));
  const symbolCol = columns.find((c) => c.id === SYMBOL);
  if (!symbolCol) return err('NO_SYMBOL', 'ستون «Symbol» در فایل پیدا نشد؛ این ستون برای شناسایی نمادها لازم است.');

  const { keep, duplicates, emptyRows } = selectRows(body, symbolCol.index);
  const dataset: Dataset = { snapshotDate, fileName, size: keep.length, symbols: [], text: {}, num: {}, meta: {} };
  const nonNumericByColumn = new Map<string, number>();

  for (const col of columns) {
    const def = dict.get(col.id);
    const isText = dict.textColumns.has(col.id) || (!def && looksTextual(keep, col.index));
    dataset.meta[col.id] = toMeta(col.id, def, isText);
    if (isText) {
      dataset.text[col.id] = keep.map((r) => textValue(r[col.index], col.id, dict.unknownTextFallback));
    } else {
      const { values, nonNumeric } = numericColumn(keep, col.index);
      dataset.num[col.id] = values;
      if (nonNumeric > 0) nonNumericByColumn.set(col.id, nonNumeric);
    }
  }
  dataset.symbols = dataset.text[SYMBOL] ?? [];
  return ok({ dataset, stats: { plan, nonNumericByColumn, duplicateSymbols: duplicates, emptySymbolRows: emptyRows } });
}

function selectRows(body: unknown[][], symbolIndex: number) {
  const seen = new Set<string>();
  const keep: unknown[][] = [];
  const duplicates: string[] = [];
  let emptyRows = 0;
  for (const row of body) {
    const cell = parseCell(row[symbolIndex]);
    if (cell.kind === 'null') {
      emptyRows++;
      continue;
    }
    const symbol = String(cell.value).trim();
    if (seen.has(symbol)) {
      duplicates.push(symbol);
      continue;
    }
    seen.add(symbol);
    keep.push(row);
  }
  return { keep, duplicates, emptyRows };
}

function looksTextual(rows: unknown[][], index: number): boolean {
  let text = 0;
  let num = 0;
  for (const r of rows) {
    const c = parseCell(r[index]);
    if (c.kind === 'text') text++;
    else if (c.kind === 'num') num++;
  }
  return text > num;
}

function textValue(raw: unknown, id: string, unknown: string): string {
  const c = parseCell(raw);
  if (c.kind === 'null') return GROUP_COLUMNS.has(id) ? unknown : '';
  return String(c.value).replace(/\s+/g, ' ').trim();
}

function numericColumn(rows: unknown[][], index: number) {
  const values = new Float64Array(rows.length);
  let nonNumeric = 0;
  rows.forEach((r, i) => {
    const c = parseCell(r[index]);
    if (c.kind === 'num') values[i] = c.value;
    else {
      values[i] = NaN;
      if (c.kind === 'text') nonNumeric++;
    }
  });
  return { values, nonNumeric };
}

function toMeta(id: string, def: ColumnDef | undefined, isText: boolean): FieldMeta {
  if (def) {
    return { ...def, source: 'raw', kind: isText ? 'text' : 'num' };
  }
  return {
    id,
    label: id,
    category: 'uncategorized',
    unit: isText ? 'text' : 'number',
    direction: 'neutral',
    source: 'raw',
    kind: isText ? 'text' : 'num',
  };
}
