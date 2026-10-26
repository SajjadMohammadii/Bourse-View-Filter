/** Built-in filter presets (PLAN.md §11.7). Users can copy/edit them in the Filter Studio. */
export interface FilterPreset {
  id: string;
  label: string;
  expression: string;
  description?: string;
  builtIn?: boolean;
}

export const filterPresets: FilterPreset[] = [
  {
    id: 'qShareHigh',
    label: 'سهم فصل آخر از سود سال بالا',
    expression: 'NI_MRQ / NI_FY > 0.35 AND NI_MRQ > 0',
  },
  {
    id: 'qJumpUptrend',
    label: 'جهش سود فصلی + روند صعودی',
    expression: 'flag.turnaroundQ OR factor.fundamentalQuarterly.Q1 > 80 AND score.technical > 60',
  },
  {
    id: 'smartMoneyTrend',
    label: 'ورود پول حقیقی در روند',
    expression: 'flag.smartMoneyIn AND factor.technical.T1 > 65',
  },
  {
    id: 'cheapGrowth',
    label: 'ارزان با رشد',
    expression: 'PtoE_ttm BETWEEN 0 AND 7 AND real(NI_3YrGR) > 0.1',
  },
  {
    id: 'recordMonth',
    label: 'رکورد درآمد ماهانه',
    expression: 'flag.recordMonth AND Exchange IN ("TSE","IFB")',
  },
  {
    id: 'lowRiskStrong',
    label: 'کم‌ریسک بنیادی قوی',
    expression: 'factor.technical.T5 > 70 AND score.fundamentalLong > 70 AND D_DebtToRev < 0.3',
  },
  {
    id: 'tseNonFinancial',
    label: 'فقط بازار بورس، صنایع غیرمالی',
    expression: 'Exchange = "TSE" AND NOT Sector = "خدمات مالی"',
  },
].map((p) => ({ ...p, builtIn: true }));
