import type { ProfileDef } from '../../core/scoring/types';
import { down, up } from './builders';

/** Short-term (monthly) fundamental profile — 6 factors (PLAN.md §10). Only symbols with Rev_1M. */
export const fundamentalMonthlyProfile: ProfileDef = {
  id: 'fundamentalMonthly',
  label: 'بنیادی ماهانه',
  description: 'کشف شرکت‌هایی که در ماه آخر متحول شده‌اند (درآمد ماهانه و رشدهای ماهانه)',
  defaultPeerScope: 'industry',
  peerBlend: 0.5,
  minCoverage: 0.6,
  eligibility: (r) => r.get('Rev_1M') !== null,
  ineligibleLabel: 'گزارش ماهانه ندارد',
  factors: [
    {
      id: 'M1',
      label: 'مومنتوم درآمد ماهانه',
      weight: 22,
      description: 'رشد ماه به ماه (واقعی)، رشد ۳ و ۵ ماهه و شتاب درآمد',
      metrics: [up('Rev_1MGR', 1, 'realM'), up('Rev_3MGR'), up('Rev_5MGR'), up('D_RevAccel_M')],
    },
    {
      id: 'M2',
      label: 'درآمد ماه نسبت به گذشته',
      weight: 24,
      description: 'درآمد ماه آخر نسبت به میانگین ۱۲ ماه (واقعی)، فصل آخر و سال مالی',
      metrics: [up('D_Rev1M_toAvg12_real'), up('D_Rev1M_toQAvg'), up('D_Rev1M_toFYAvg')],
    },
    {
      id: 'M3',
      label: 'رشد تجمعی سالانه',
      weight: 14,
      description: 'رشد تجمعی درآمد نسبت به سال قبل و رشد ۷ و ۹ ماهه',
      metrics: [up('RevCumMonthlyGR_YoY', 1, 'real'), up('Rev_7MGR'), up('Rev_9MGR')],
    },
    {
      id: 'M4',
      label: 'ارزش‌گذاری بر پایه درآمد ماهانه',
      weight: 16,
      description: 'P/S و EV/S ماهانه و بازده درآمد ماه سالانه‌شده',
      metrics: [down('PtoS_Monthly'), down('EVtoS_Monthly'), up('D_RevYield_M')],
    },
    {
      id: 'M5',
      label: 'سود ضمنی',
      weight: 16,
      description: 'P/E ضمنی، رشد ضمنی سود و نسبت درآمد ماه به سود سال',
      metrics: [down('D_ImpliedPE_M'), up('D_ImpliedEarnGrowth_M'), up('D_Rev1M_toNI_FY')],
    },
    {
      id: 'M6',
      label: 'ثبات',
      weight: 8,
      description: 'ثبات رشد ماهانه و میانگین حسابی رشدها',
      metrics: [up('D_RevConsistency_M'), up('Rev_3MGR_Arith'), up('Rev_5MGR_Arith'), up('Prod_Mo3MAvgGR')],
    },
  ],
  weightPresets: {
    balanced: { label: 'متعادل', weights: { M1: 22, M2: 24, M3: 14, M4: 16, M5: 16, M6: 8 } },
    momentum: { label: 'مومنتوم درآمد', weights: { M1: 30, M2: 30, M3: 14, M4: 10, M5: 10, M6: 6 } },
    value: { label: 'ارزش', weights: { M1: 14, M2: 16, M3: 10, M4: 28, M5: 26, M6: 6 } },
  },
  derivedScores: [
    {
      id: 'mTransform',
      label: 'شاخص تحول ماهانه',
      description: 'M1 (۵۰٪) + M2 (۵۰٪)',
      parts: [
        { factor: 'M1', weight: 0.5 },
        { factor: 'M2', weight: 0.5 },
      ],
    },
  ],
};
