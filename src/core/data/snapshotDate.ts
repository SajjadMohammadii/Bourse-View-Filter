import type { JalaliDate } from '../types';
import { isValidJalali } from '../utils/jalali';
import { toLatinDigits } from '../utils/digits';

/** Extracts the Jalali snapshot date from names like `screener-plus-1405-08-04.xlsx`. */
export function snapshotDateFromFileName(fileName: string): JalaliDate | null {
  const match = /(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})/.exec(toLatinDigits(fileName));
  if (!match) return null;
  const date = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  return isValidJalali(date) ? date : null;
}
