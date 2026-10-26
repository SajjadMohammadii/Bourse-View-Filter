import { utils, writeFile } from 'xlsx';
import type { Dataset } from '../../core/types';

export type ExportFormat = 'xlsx' | 'csv';

/** Rows × fields as a sheet: first header row = Persian labels, second = field ids. */
export function exportRows(
  ds: Dataset,
  indices: number[],
  fields: string[],
  fileName: string,
  format: ExportFormat,
): void {
  const labels = fields.map((f) => ds.meta[f]?.label ?? f);
  const body = indices.map((i) =>
    fields.map((f) => {
      const num = ds.num[f];
      if (num) {
        const v = num[i] as number;
        return Number.isFinite(v) ? v : null;
      }
      return ds.text[f]?.[i] ?? null;
    }),
  );
  const sheet = utils.aoa_to_sheet([labels, fields, ...body]);
  sheet['!rtl'] = true;
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Bourse View Filters');
  if (!book.Workbook) book.Workbook = {};
  book.Workbook.Views = [{ RTL: true }];
  writeFile(book, `${fileName}.${format}`, { bookType: format, compression: true });
}

/** Triggers a download of a text file (JSON backups). */
export function downloadText(text: string, fileName: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens a file picker and resolves with the chosen file's text (null when cancelled). */
export function pickTextFile(accept = '.json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      void f.text().then(resolve);
    });
    input.click();
  });
}
