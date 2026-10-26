import { read, utils } from 'xlsx';
import type { Result } from '../../core/types';
import { readFirstSheetFast } from './fastXlsx';
import { err, ok } from '../../core/types';

/** Reads the first sheet of an Excel/CSV file into raw rows (PLAN.md §4 step 1). */
export function readWorkbook(buffer: ArrayBuffer): Result<unknown[][]> {
  const fast = tryFast(buffer);
  if (fast) return withoutLeadingBlankRows(fast);
  return readWithSheetJs(buffer);
}

function tryFast(buffer: ArrayBuffer): unknown[][] | null {
  try {
    return readFirstSheetFast(buffer);
  } catch {
    return null; // anything unusual → SheetJS
  }
}

function withoutLeadingBlankRows(rows: unknown[][]): Result<unknown[][]> {
  const first = rows.findIndex((r) => r.some((c) => c !== null && c !== undefined && c !== ''));
  const trimmed = first < 0 ? [] : rows.slice(first);
  if (trimmed.length < 2) return err('EMPTY', 'فایل داده‌ای ندارد (فقط سرستون یا خالی).');
  return ok(trimmed);
}

/** General path for .xls, .csv and anything the fast reader declines. */
export function readWithSheetJs(buffer: ArrayBuffer): Result<unknown[][]> {
  try {
    // Only raw cell values are used: skipping formatted text, number formats, HTML, styles and
    // formulas makes reading ~30% faster (PLAN.md §15 phase 9: full load < 2 s).
    const wb = read(new Uint8Array(buffer), {
      type: 'array',
      dense: true,
      cellDates: false,
      cellText: false,
      cellNF: false,
      cellHTML: false,
      cellStyles: false,
      cellFormula: false,
      sheetStubs: false,
    });
    const first = wb.SheetNames[0];
    const sheet = first ? wb.Sheets[first] : undefined;
    if (!sheet) return err('NO_SHEET', 'فایل هیچ شیتی ندارد.');
    const rows = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    if (rows.length < 2) return err('EMPTY', 'فایل داده‌ای ندارد (فقط سرستون یا خالی).');
    return ok(rows);
  } catch (e) {
    return err('READ_FAILED', 'خواندن فایل ممکن نشد؛ مطمئن شوید فایل اکسل معتبر است.', String(e));
  }
}
