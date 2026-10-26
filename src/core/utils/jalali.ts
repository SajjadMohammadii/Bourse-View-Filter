import type { JalaliDate } from '../types';

// Jalali ↔ Julian Day Number (algorithm by Roozbeh Pournader & Mohammad Toossi, as in jalaali-js).
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
];

const div = (a: number, b: number): number => ~~(a / b);
const mod = (a: number, b: number): number => a - ~~(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0] as number;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i] as number;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian day number of a Jalali date. */
export function jalaliToJdn({ y, m, d }: JalaliDate): number {
  const r = jalCal(y);
  return g2d(r.gy, 3, r.march) + (m - 1) * 31 - div(m, 7) * (m - 7) + d - 1;
}

export function isValidJalali({ y, m, d }: JalaliDate): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1200 || y > 1600 || m < 1 || m > 12 || d < 1) return false;
  const max = m <= 6 ? 31 : m <= 11 ? 30 : jalCal(y).leap === 0 ? 30 : 29;
  return d <= max;
}

/** Days between two Jalali dates (b − a). */
export function daysBetween(a: JalaliDate, b: JalaliDate): number {
  return jalaliToJdn(b) - jalaliToJdn(a);
}

/** Parses the YYYYMMDD integer form used by LastStatementDate. */
export function fromCompact(n: number): JalaliDate | null {
  if (!Number.isFinite(n)) return null;
  const date = { y: Math.floor(n / 10000), m: Math.floor(n / 100) % 100, d: n % 100 };
  return isValidJalali(date) ? date : null;
}

export function formatJalali({ y, m, d }: JalaliDate, sep = '/'): string {
  return [y, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join(sep);
}

export function compareJalali(a: JalaliDate, b: JalaliDate): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;
