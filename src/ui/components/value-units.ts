import type { Unit } from '../../core/types';
import { RIAL_PER_HEMAT } from '../../core/utils/format';
import { fa } from '../../i18n/fa';

/** Input units for builder values: users type 35 for 35٪ and 5 for 5 همت (PLAN.md §11.6). */
export function inputScale(unit: Unit | undefined): { factor: number; suffix: string } {
  if (unit === 'percent') return { factor: 0.01, suffix: '٪' };
  if (unit === 'rial') return { factor: RIAL_PER_HEMAT, suffix: fa.builder.hemat };
  if (unit === 'days') return { factor: 1, suffix: fa.builder.days };
  return { factor: 1, suffix: '' };
}

export const toStored = (display: number, unit: Unit | undefined): number =>
  display * inputScale(unit).factor;
export const toDisplay = (stored: number, unit: Unit | undefined): number =>
  Number((stored / inputScale(unit).factor).toPrecision(10));
