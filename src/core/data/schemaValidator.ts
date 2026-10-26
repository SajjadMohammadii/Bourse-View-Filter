import type { ColumnCoverage, DataHealthReport, Dataset } from '../types';
import type { BuildStats } from './buildDataset';

export interface ValidationInput {
  dataset: Dataset;
  stats: BuildStats;
  /** All dictionary column ids (excluding ignored ones). */
  knownColumns: Iterable<string>;
  /** Columns referenced by metrics / profiles. */
  requiredColumns: Iterable<string>;
  unknownSector: string;
}

/** Positive-only columns: a value ≤ 0 is reported as implausible. */
const POSITIVE_COLUMNS = ['MarketCap', 'Price', 'NumberOfOutstandingShares'];

/** Produces the data-health report (PLAN.md §4 step 4). */
export function validateSchema(input: ValidationInput): DataHealthReport {
  const { dataset, stats } = input;
  const present = new Set(Object.keys(dataset.meta));
  const known = new Set(input.knownColumns);
  const missingColumns = [...known].filter((id) => !present.has(id));
  const missingRequired = [...new Set(input.requiredColumns)].filter((id) => !present.has(id));
  const unknownColumns = [...present].filter((id) => !known.has(id));
  const coverage = computeCoverage(dataset, stats.nonNumericByColumn);
  const nonNumericCells = [...stats.nonNumericByColumn.values()].reduce((a, b) => a + b, 0);

  const warnings: string[] = [];
  if (missingRequired.length) warnings.push(`${missingRequired.length} ستون مورد نیاز امتیازدهی در فایل نیست.`);
  if (unknownColumns.length) warnings.push(`${unknownColumns.length} ستون جدید (ناشناخته) در فایل وجود دارد.`);
  if (stats.duplicateSymbols.length) warnings.push(`${stats.duplicateSymbols.length} نماد تکراری حذف شد.`);
  if (dataset.size === 0) warnings.push('فایل هیچ نماد معتبری ندارد.');

  return {
    rowCount: dataset.size,
    columnCount: present.size,
    droppedColumns: stats.plan.dropped,
    renamedColumns: stats.plan.renamed,
    unknownColumns,
    missingColumns,
    missingRequired,
    duplicateSymbols: stats.duplicateSymbols,
    emptySymbolRows: stats.emptySymbolRows,
    noSectorSymbols: symbolsWithoutSector(dataset, input.unknownSector),
    nonNumericCells,
    implausible: findImplausible(dataset),
    coverage,
    warnings,
  };
}

function computeCoverage(dataset: Dataset, nonNumeric: Map<string, number>): ColumnCoverage[] {
  return Object.values(dataset.meta).map((meta) => {
    let filled = 0;
    const num = dataset.num[meta.id];
    const text = dataset.text[meta.id];
    if (num) for (const v of num) filled += Number.isNaN(v) ? 0 : 1;
    else if (text) for (const v of text) filled += v === '' ? 0 : 1;
    return {
      id: meta.id,
      label: meta.label,
      category: meta.category,
      kind: meta.kind,
      filled,
      coverage: dataset.size ? filled / dataset.size : 0,
      nonNumericCells: nonNumeric.get(meta.id) ?? 0,
    };
  });
}

function symbolsWithoutSector(dataset: Dataset, unknownSector: string): string[] {
  const sector = dataset.text['Sector'];
  if (!sector) return [];
  return dataset.symbols.filter((_, i) => sector[i] === unknownSector);
}

function findImplausible(dataset: Dataset): DataHealthReport['implausible'] {
  const out: DataHealthReport['implausible'] = [];
  for (const column of POSITIVE_COLUMNS) {
    const values = dataset.num[column];
    if (!values) continue;
    values.forEach((v, i) => {
      if (v <= 0) out.push({ symbol: dataset.symbols[i] ?? '', column, value: v, reason: 'مقدار غیرمثبت' });
    });
  }
  return out;
}
