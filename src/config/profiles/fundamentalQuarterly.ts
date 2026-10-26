import type { ProfileDef } from '../../core/scoring/types';
import { down, up } from './builders';

/** Mid-term (quarterly) fundamental profile — 7 factors (PLAN.md §9): who transformed last quarter. */
export const fundamentalQuarterlyProfile: ProfileDef = {
  id: 'fundamentalQuarterly',
  label: 'بنیادی فصلی',
  description: 'کشف شرکت‌هایی که در فصل آخر متحول شده‌اند (MRQ و رشدهای فصلی)',
  defaultPeerScope: 'industry',
  peerBlend: 0.5,
  minCoverage: 0.6,
  stalePenalty: true,
  factors: [
    {
      id: 'Q1',
      label: 'جهش سود فصل',
      weight: 22,
      description: 'رشد فصلی و سالانه سود خالص/عملیاتی، سود سالانه‌شده و سهم فصل از سود سال',
      metrics: [
        up('NIQtrlyGR_QoQ', 1, 'realQ'),
        up('NIQtrlyGR_YoY', 1, 'real'),
        up('OPQtrlyGR_QoQ', 1, 'realQ'),
        up('OPQtrlyGR_YoY', 1, 'real'),
        up('GPQtrlyGR_YoY', 1, 'real'),
        up('D_NI_RunRate'),
        up('D_NI_MRQ_toFY'),
        up('D_NI_MRQ_toTTM'),
      ],
    },
    {
      id: 'Q2',
      label: 'رشد فروش فصل',
      weight: 14,
      description: 'رشد فصلی و سالانه فروش و فروش سالانه‌شده',
      metrics: [up('RevQtrlyGR_QoQ', 1, 'realQ'), up('RevQtrlyGR_YoY', 1, 'real'), up('D_Rev_RunRateQ')],
    },
    {
      id: 'Q3',
      label: 'بهبود حاشیه سود فصل',
      weight: 16,
      description: 'بهبود حاشیه‌های فصل نسبت به ۱۲ ماهه و فصل مشابه و سطح حاشیه خالص',
      metrics: [
        up('D_dNPMargin_Q'),
        up('D_dGPMargin_Q'),
        up('D_dOPMargin_Q'),
        up('NP_Margin_MRQ_QrtlyGR_YoY'),
        up('GP-Margin-MRQ-QrtlyGR-YoY'),
        up('OP-Margin-MRQ-QrtlyGR-YoY'),
        up('NPMarginMRQ'),
      ],
    },
    {
      id: 'Q4',
      label: 'ارزش‌گذاری بر پایه فصل',
      weight: 16,
      description: 'بازده سود و فروش سالانه‌شده فصل و P/E پیش‌رو',
      metrics: [up('D_FwdEY_Q'), down('D_FwdPE_Q'), up('D_RevYield_Q'), up('D_OPYield_Q')],
    },
    {
      id: 'Q5',
      label: 'پایداری روند چندفصلی',
      weight: 10,
      description: 'رشد ۳ و ۵ فصلی؛ تمایز جهش یک‌باره از روند پایدار',
      metrics: [
        up('Rev_3qGR'),
        up('Rev_5qGR'),
        up('NI_3qGR'),
        up('OP_3qGR'),
        up('GP_5qGR'),
        up('OP-Margin-MRQ-3qGR'),
        up('NP_Margin_MRQ_3qGR'),
      ],
    },
    {
      id: 'Q6',
      label: 'تحولات ترازنامه و بدهی فصل',
      weight: 12,
      description: 'تغییر اهرم، بدهی، حقوق صاحبان سهام و سود انباشته از پایان سال',
      metrics: [
        down('D_dLevGap'),
        down('D_dTL'),
        up('D_dEquity'),
        up('D_dRE'),
        down('D_DebtToRev_Q'),
        down('D_FEtoOP_Q'),
      ],
    },
    {
      id: 'Q7',
      label: 'کیفیت سود فصل',
      weight: 10,
      description: 'سهم سود غیرعملیاتی و ارزی و تازگی صورت مالی',
      metrics: [down('D_NonOpShare_Q'), down('D_FxShareNI_Q', 1, 'abs'), down('D_StatementAgeDays')],
    },
  ],
  weightPresets: {
    balanced: { label: 'متعادل', weights: { Q1: 22, Q2: 14, Q3: 16, Q4: 16, Q5: 10, Q6: 12, Q7: 10 } },
    turnaround: { label: 'تحول', weights: { Q1: 30, Q2: 16, Q3: 22, Q4: 8, Q5: 8, Q6: 8, Q7: 8 } },
    value: { label: 'ارزش', weights: { Q1: 16, Q2: 10, Q3: 12, Q4: 32, Q5: 10, Q6: 10, Q7: 10 } },
  },
  derivedScores: [
    {
      id: 'qTransform',
      label: 'شاخص تحول فصلی',
      description: 'Q1 (۵۰٪) + Q3 (۳۰٪) + Q2 (۲۰٪)؛ مستقل از ارزش‌گذاری',
      parts: [
        { factor: 'Q1', weight: 0.5 },
        { factor: 'Q3', weight: 0.3 },
        { factor: 'Q2', weight: 0.2 },
      ],
    },
  ],
};
