import type { IndustryOverride } from '../core/scoring/types';
import { down } from './profiles/builders';

/** Declarative per-industry scoring adjustments (PLAN.md §6.9). Industry names as in the screener export. */

export const FINANCIAL_INDUSTRIES = [
  'بانکها و موسسات اعتباری',
  'بیمه',
  'سرمایه گذاری',
  'سرمایه گذاری استانی',
  'لیزینگ',
  'تامین سرمایه',
  'فعالیتهای مرتبط با اوراق بهادار',
];

export const industryOverrides: IndustryOverride[] = [
  {
    id: 'financials',
    label: 'صنایع مالی',
    industries: FINANCIAL_INDUSTRIES,
    disableFactors: ['L6'],
    disableMetrics: [
      'CurrentRatio',
      'Quickratio',
      'InvTurnoverDay',
      'D_CCC_approx',
      'GPMargin',
      // Gross margin is not meaningful for financials in the quarterly view either.
      'D_dGPMargin_Q',
      'GP-Margin-MRQ-QrtlyGR-YoY',
      'GPQtrlyGR_YoY',
    ],
  },
  {
    id: 'banksLeasing',
    label: 'بانک و لیزینگ',
    industries: ['بانکها و موسسات اعتباری', 'لیزینگ'],
    // Debt is the business itself: leverage metrics are not a risk signal here.
    disableMetrics: [
      'LiabilityToAsset',
      'LiabilityToEquity',
      'DebtToEquity',
      'D_DebtToRev',
      'D_DebtToOP',
      'ICR',
      'D_FEtoOP',
      'D_AltmanZ_approx',
      'D_DebtToRev_Q',
      'D_FEtoOP_Q',
      'D_dLevGap',
      'D_dTL',
    ],
    weightMultipliers: { ROE: 2, ROA: 2 },
  },
  {
    id: 'investment',
    label: 'شرکت‌های سرمایه‌گذاری',
    industries: ['سرمایه گذاری', 'سرمایه گذاری استانی'],
    extraMetrics: { L7: [down('PtoNAV', 3)] },
  },
];

/**
 * Seasonality mode (PLAN.md §10): around Esfand/Farvardin reports, month-over-month growth is
 * dominated by the calendar, so its weight is reduced for every symbol.
 */
export const seasonality = {
  /** Snapshot months (Jalali) in which the rule applies: reports of Esfand and Farvardin. */
  months: [1, 2],
  override: {
    id: 'seasonality',
    label: 'حالت فصلی‌بودن',
    industries: ['*'],
    profiles: ['fundamentalMonthly'],
    weightMultipliers: { Rev_1MGR: 0.3, D_RevAccel_M: 0.3 },
  } satisfies IndustryOverride,
};
