import type { JalaliDate, Unit } from '../types';
import { formatJalali } from './jalali';

export type MoneyUnit = 'hemat' | 'billionToman' | 'rial';
export type DigitStyle = 'fa' | 'latin';

export interface FormatOptions {
  moneyUnit: MoneyUnit;
  digits: DigitStyle;
}

export const defaultFormatOptions: FormatOptions = { moneyUnit: 'hemat', digits: 'fa' };

/** 1 همت = هزار میلیارد تومان = 10^13 ریال. */
export const RIAL_PER_HEMAT = 1e13;
export const RIAL_PER_BILLION_TOMAN = 1e10;
export const NULL_TEXT = '—';
export const NEGATIVE_BASE_TEXT = 'پایه منفی';

const cache = new Map<string, Intl.NumberFormat>();

function nf(digits: DigitStyle, maxFrac: number, minFrac = 0): Intl.NumberFormat {
  const key = `${digits}|${maxFrac}|${minFrac}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(digits === 'fa' ? 'fa-IR' : 'en-US', {
      maximumFractionDigits: maxFrac,
      minimumFractionDigits: minFrac,
    });
    cache.set(key, f);
  }
  return f;
}

export function formatNumber(v: number, maxFrac = 2, opts: FormatOptions = defaultFormatOptions): string {
  if (!Number.isFinite(v)) return v === -Infinity ? NEGATIVE_BASE_TEXT : NULL_TEXT;
  return nf(opts.digits, maxFrac).format(v);
}

export function formatPercent(v: number, maxFrac = 2, opts: FormatOptions = defaultFormatOptions): string {
  if (!Number.isFinite(v)) return formatNumber(v, maxFrac, opts);
  return `${nf(opts.digits, maxFrac).format(v * 100)}٪`;
}

export function formatMoney(rial: number, opts: FormatOptions = defaultFormatOptions): string {
  if (!Number.isFinite(rial)) return formatNumber(rial, 0, opts);
  if (opts.moneyUnit === 'rial') return nf(opts.digits, 0).format(rial);
  const [div, suffix] =
    opts.moneyUnit === 'hemat' ? [RIAL_PER_HEMAT, 'همت'] : [RIAL_PER_BILLION_TOMAN, 'میلیارد تومان'];
  const x = rial / div;
  const frac = Math.abs(x) >= 100 ? 1 : Math.abs(x) >= 1 ? 2 : 3;
  return `${nf(opts.digits, frac).format(x)} ${suffix}`;
}

/** Compact large counts: 4.5B → «۴٫۵ میلیارد». */
export function formatCompact(v: number, opts: FormatOptions = defaultFormatOptions): string {
  if (!Number.isFinite(v)) return formatNumber(v, 0, opts);
  const abs = Math.abs(v);
  const steps: Array<[number, string]> = [
    [1e12, 'هزار میلیارد'],
    [1e9, 'میلیارد'],
    [1e6, 'میلیون'],
    [1e3, 'هزار'],
  ];
  for (const [base, name] of steps) {
    if (abs >= base) return `${nf(opts.digits, 2).format(v / base)} ${name}`;
  }
  return nf(opts.digits, 2).format(v);
}

export function formatDate(d: JalaliDate | null, opts: FormatOptions = defaultFormatOptions): string {
  if (!d) return NULL_TEXT;
  const s = formatJalali(d);
  return opts.digits === 'fa' ? s.replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)] ?? c) : s;
}

/** Formats a value according to its field unit (PLAN.md §12.4). */
export function formatByUnit(v: number, unit: Unit, opts: FormatOptions = defaultFormatOptions): string {
  switch (unit) {
    case 'percent':
      return formatPercent(v, 2, opts);
    case 'rial':
      return formatMoney(v, opts);
    case 'volume':
      return formatCompact(v, opts);
    case 'days':
      return Number.isFinite(v) ? `${formatNumber(v, 0, opts)} روز` : formatNumber(v, 0, opts);
    case 'score':
      return formatNumber(v, 1, opts);
    case 'rank':
    case 'flag':
      return formatNumber(v, 0, opts);
    case 'date':
      return formatCompactDate(v, opts);
    case 'price':
      return formatNumber(v, Math.abs(v) >= 1000 ? 0 : 2, opts);
    default:
      return formatNumber(v, Math.abs(v) >= 1e6 ? 0 : 2, opts);
  }
}

function formatCompactDate(v: number, opts: FormatOptions): string {
  if (!Number.isFinite(v)) return NULL_TEXT;
  const d = { y: Math.floor(v / 10000), m: Math.floor(v / 100) % 100, d: v % 100 };
  return formatDate(d, opts);
}
