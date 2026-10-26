/**
 * Synthetic "next day" fixture derived from the sample (PLAN.md §15 phase 8):
 * removes two symbols, adds one new symbol, and shifts a few technical inputs.
 */
export const REMOVED = ['ذوب', 'فولاد'];
export const ADDED = 'تستجدید';
export const SECOND_NAME = 'screener-plus-1405-08-05.xlsx';
export const CLONE_OF = 'وفردا';

export function secondDayRows(rows: unknown[][]): unknown[][] {
  const header = rows[0] as unknown[];
  const col = (name: string) => header.indexOf(name);
  const sym = col('Symbol');
  const body = rows.slice(1).filter((r) => !REMOVED.includes(String(r[sym])));
  const shift = (r: unknown[], name: string, f: (v: number) => number) => {
    const k = col(name);
    if (k >= 0 && typeof r[k] === 'number') r[k] = f(r[k] as number);
  };
  const changed = body.map((r, i) => {
    const copy = [...r];
    if (i % 7 === 0) {
      shift(copy, 'Ret_1M', (v) => v + 0.15);
      shift(copy, 'Ret_3M', (v) => v + 0.2);
      shift(copy, 'RSI', (v) => Math.min(65, v + 10));
      shift(copy, 'NetIndividual', (v) => v + 0.1);
    }
    return copy;
  });
  // Clone the day-1 composite leader so the new symbol lands in the Top 20 (a guaranteed newcomer).
  const leader = body.find((r) => r[sym] === CLONE_OF) ?? body[0];
  const clone = [...(leader as unknown[])];
  clone[sym] = ADDED;
  clone[col('Company')] = 'شرکت آزمایشی جدید';
  return [header, ...changed, clone];
}
