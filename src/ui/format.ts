import { defaultFormatOptions, formatByUnit, formatNumber, type FormatOptions } from '../core/utils/format';
import type { Unit } from '../core/types';

let current: FormatOptions = defaultFormatOptions;

/** Display preferences (digits, money unit) currently selected in Settings. */
export const fmt = (): FormatOptions => current;

export function setFormat(o: FormatOptions): void {
  current = o;
}

export const fv = (v: number | undefined, unit: Unit): string => formatByUnit(v ?? NaN, unit, current);

/** Plain number in the user's digit style (for chart labels). */
export const num = (v: number, maxFrac = 2): string => formatNumber(v, maxFrac, current);
