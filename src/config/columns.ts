import type { Category, ColumnDef, Direction, Unit } from '../core/types';

/**
 * Data Dictionary (PLAN.md §1.3): metadata for every known screener column.
 * Families with a regular naming scheme are generated; each generated id is a real column.
 * Unknown columns are still usable — they get category 'uncategorized' at load time.
 */

type Extra = Partial<Pick<ColumnDef, 'horizon' | 'description' | 'aliases' | 'kind'>>;

const defs: ColumnDef[] = [];

function add(
  id: string,
  label: string,
  category: Category,
  unit: Unit,
  direction: Direction = 'neutral',
  extra: Extra = {},
): void {
  defs.push({ id, label, category, unit, direction, ...extra });
}

const fa = (n: number): string => n.toLocaleString('fa-IR');

// ───────────────────────────── identity ─────────────────────────────
add('Company', 'نام شرکت', 'identity', 'text', 'neutral', { kind: 'text' });
add('Symbol', 'نماد', 'identity', 'text', 'neutral', { kind: 'text' });
add('Chart', 'نمودار', 'identity', 'text', 'neutral', {
  kind: 'text',
  description: 'ستون ثابت «Chart»؛ استفاده نمی‌شود.',
});
add('Exchange', 'بازار', 'identity', 'text', 'neutral', {
  kind: 'text',
  description: 'TSE=بورس، IFB=فرابورس، OTC=پایه',
});
add('Sector', 'بخش', 'identity', 'text', 'neutral', { kind: 'text' });
add('Industry', 'صنعت', 'identity', 'text', 'neutral', { kind: 'text' });
add('FiscalYear', 'پایان سال مالی (MMDD)', 'identity', 'number', 'neutral', {
  description: 'ماه و روز پایان سال مالی؛ 1229 یعنی ۲۹ اسفند.',
});
add('LastStatementDate', 'تاریخ آخرین صورت مالی', 'identity', 'date', 'neutral', {
  description: 'تاریخ شمسی به شکل YYYYMMDD.',
});

// ───────────────────────────── price ─────────────────────────────
add('Price', 'قیمت', 'price', 'price');
add('Open', 'قیمت باز شدن', 'price', 'price');
add('High', 'بیشترین قیمت روز', 'price', 'price');
add('Low', 'کمترین قیمت روز', 'price', 'price');
add('VWAP', 'میانگین وزنی قیمت روز', 'price', 'price');
add('DailyChange', 'تغییر روزانه', 'price', 'percent', 'higher');
for (const p of ['1W', '1M'] as const) {
  const span = p === '1W' ? 'یک هفته' : 'یک ماه';
  add(`Close_${p}`, `قیمت پایانی ${span}`, 'price', 'price');
  add(`Open_${p}`, `قیمت آغاز ${span}`, 'price', 'price');
  add(`High_${p}`, `سقف ${span}`, 'price', 'price');
  add(`Low_${p}`, `کف ${span}`, 'price', 'price');
  add(`AvgVWAP_${p}`, `میانگین VWAP ${span}`, 'price', 'price');
}
add('avgprice', 'قیمت میانگین (OHLC)', 'price', 'price');
add('medprice', 'قیمت میانه (High/Low)', 'price', 'price');

// ───────────────────────────── size ─────────────────────────────
add('MarketCap', 'ارزش بازار', 'size', 'rial');
add('NumberOfOutstandingShares', 'تعداد سهام', 'size', 'volume');
add('BaseVolume', 'حجم مبنا', 'size', 'volume');

// ───────────────────────────── income statement ─────────────────────────────
const items = { Rev: 'درآمد', GP: 'سود ناخالص', OP: 'سود عملیاتی', NI: 'سود خالص' } as const;
type Item = keyof typeof items;
const itemKeys = Object.keys(items) as Item[];

for (const k of itemKeys) {
  add(`${k}_TTM`, `${items[k]} ۱۲ ماهه (TTM)`, 'incomeAnnual', 'rial', 'higher', { horizon: 'long' });
  add(`${k}_FY`, `${items[k]} آخرین سال مالی`, 'incomeAnnual', 'rial', 'higher', { horizon: 'long' });
  add(`${k}_MRQ`, `${items[k]} آخرین فصل`, 'incomeQuarterly', 'rial', 'higher', { horizon: 'quarter' });
}
add('EBIT', 'سود قبل از بهره و مالیات', 'incomeAnnual', 'rial', 'higher', { horizon: 'long' });
add('FE_TTM', 'هزینه مالی ۱۲ ماهه', 'incomeAnnual', 'rial', 'lower', { horizon: 'long' });
add('FE_FY', 'هزینه مالی سال مالی', 'incomeAnnual', 'rial', 'lower', { horizon: 'long' });
add('FE_MRQ', 'هزینه مالی آخرین فصل', 'incomeQuarterly', 'rial', 'lower', { horizon: 'quarter' });
add('EPS_TTM', 'سود هر سهم ۱۲ ماهه', 'incomeAnnual', 'price', 'higher', { horizon: 'long' });
add('EPS_FY', 'سود هر سهم سال مالی', 'incomeAnnual', 'price', 'higher', { horizon: 'long' });
add('EPS_MRQ', 'سود هر سهم فصل', 'incomeQuarterly', 'price', 'higher', { horizon: 'quarter' });
add('EPS_MRQ_LC', 'سود هر سهم فصل (سرمایه جدید)', 'incomeQuarterly', 'price', 'higher', {
  horizon: 'quarter',
  description: 'EPS فصل بر پایه آخرین سرمایه (فرض PLAN §17).',
});
add('NetFx_IRR', 'سود/زیان خالص تسعیر ارز', 'incomeQuarterly', 'rial', 'neutral', { horizon: 'quarter' });
add('Rev_1M', 'درآمد آخرین ماه', 'incomeMonthly', 'rial', 'higher', { horizon: 'month' });

// ───────────────────────────── balance sheet ─────────────────────────────
const balance = {
  TA: 'جمع دارایی‌ها',
  TL: 'جمع بدهی‌ها',
  TSE: 'حقوق صاحبان سهام',
  RE: 'سود (زیان) انباشته',
} as const;
for (const [k, label] of Object.entries(balance)) {
  const dir: Direction = k === 'TL' ? 'lower' : 'higher';
  add(`${k}_MRQ`, `${label} (آخرین فصل)`, 'balance', 'rial', dir, { horizon: 'quarter' });
  add(`${k}_FY`, `${label} (پایان سال مالی)`, 'balance', 'rial', dir, { horizon: 'long' });
}

// ───────────────────────────── ratios ─────────────────────────────
const L = { horizon: 'long' } as const;
add('ROA', 'بازده دارایی‌ها', 'ratioProfitability', 'percent', 'higher', L);
add('ROE', 'بازده حقوق صاحبان سهام', 'ratioProfitability', 'percent', 'higher', L);
add('NPMargin', 'حاشیه سود خالص', 'ratioProfitability', 'percent', 'higher', L);
add('GPMargin', 'حاشیه سود ناخالص', 'ratioProfitability', 'percent', 'higher', L);
add('OPMargin', 'حاشیه سود عملیاتی', 'ratioProfitability', 'percent', 'higher', L);
add('NPMarginMRQ', 'حاشیه سود خالص فصل', 'ratioProfitability', 'percent', 'higher', { horizon: 'quarter' });
add('GPMarginMRQ', 'حاشیه سود ناخالص فصل', 'ratioProfitability', 'percent', 'higher', { horizon: 'quarter' });
add('OPMarginMRQ', 'حاشیه سود عملیاتی فصل', 'ratioProfitability', 'percent', 'higher', {
  horizon: 'quarter',
});
add('ETR', 'نرخ مؤثر مالیات', 'ratioProfitability', 'percent', 'neutral', L);

add('AssetTurnover', 'گردش دارایی', 'ratioEfficiency', 'times', 'higher', L);
add('FixedAssetTO', 'گردش دارایی ثابت', 'ratioEfficiency', 'times', 'higher', L);
add('InvTurnover', 'گردش موجودی کالا', 'ratioEfficiency', 'times', 'higher', L);
add('InvTurnoverDay', 'دوره گردش موجودی', 'ratioEfficiency', 'days', 'lower', L);
add('ReceivableTurnover', 'گردش مطالبات', 'ratioEfficiency', 'times', 'higher', L);
add('ReceivableTurnoverDay', 'دوره وصول مطالبات', 'ratioEfficiency', 'days', 'lower', L);

add('LiabilityToAsset', 'نسبت بدهی', 'ratioLeverage', 'percent', 'lower', {
  ...L,
  description: 'TL_MRQ / TA_MRQ',
});
add('LiabilityToEquity', 'بدهی به حقوق صاحبان سهام', 'ratioLeverage', 'ratio', 'lower', L);
add('DebtRatio', 'بدهی مالی به دارایی', 'ratioLeverage', 'percent', 'lower', {
  ...L,
  description: 'بدهی مالی (تسهیلات) ÷ TA_MRQ — تأییدشده روی داده.',
});
add('DebtToEquity', 'بدهی مالی به حقوق صاحبان سهام', 'ratioLeverage', 'ratio', 'lower', L);
add('LTDebtRatio', 'بدهی بلندمدت به دارایی', 'ratioLeverage', 'percent', 'lower', L);
add('ICR', 'پوشش هزینه بهره', 'ratioLeverage', 'times', 'higher', L);
add('CurrentRatio', 'نسبت جاری', 'ratioLeverage', 'ratio', 'band', L);
add('Quickratio', 'نسبت آنی', 'ratioLeverage', 'ratio', 'higher', L);
add('RetainedEarningToAsset', 'سود انباشته به دارایی', 'ratioLeverage', 'percent', 'higher', L);

add('CFOToRev', 'جریان نقد عملیاتی به فروش', 'ratioCashflow', 'percent', 'higher', L);
add('CFOToDebt', 'جریان نقد عملیاتی به بدهی', 'ratioCashflow', 'percent', 'higher', L);
add('CFFToRev', 'جریان نقد تأمین مالی به فروش', 'ratioCashflow', 'percent', 'neutral', L);
add('CFIToRev', 'جریان نقد سرمایه‌گذاری به فروش', 'ratioCashflow', 'percent', 'neutral', L);
add('FCFFToRev', 'جریان نقد آزاد شرکت به فروش', 'ratioCashflow', 'percent', 'higher', L);
add('FCFFToNI', 'جریان نقد آزاد شرکت به سود', 'ratioCashflow', 'ratio', 'higher', L);
add('FCFEToRev', 'جریان نقد آزاد سهامدار به فروش', 'ratioCashflow', 'percent', 'higher', L);
add('FCFEToNI', 'جریان نقد آزاد سهامدار به سود', 'ratioCashflow', 'ratio', 'higher', L);
add('CAPEXToRev', 'مخارج سرمایه‌ای به فروش', 'ratioCashflow', 'percent', 'neutral', L);
add('CAPEXToNI', 'مخارج سرمایه‌ای به سود', 'ratioCashflow', 'ratio', 'neutral', L);
add('PayoutRatio', 'نسبت تقسیم سود', 'ratioCashflow', 'percent', 'band', L);

// ───────────────────────────── valuation ─────────────────────────────
add('PtoE_ttm', 'P/E (۱۲ ماهه)', 'valuation', 'ratio', 'lower', { ...L, description: 'MarketCap / NI_TTM' });
add('PtoB', 'P/B', 'valuation', 'ratio', 'lower', L);
add('PtoS', 'P/S', 'valuation', 'ratio', 'lower', L);
add('PtoS_Monthly', 'P/S بر پایه درآمد ماهانه', 'valuation', 'ratio', 'lower', { horizon: 'month' });
add('PtoFCFF', 'P/FCFF', 'valuation', 'ratio', 'lower', L);
add('PtoFCFE', 'P/FCFE', 'valuation', 'ratio', 'lower', L);
add('PtoNAV', 'P/NAV', 'valuation', 'ratio', 'lower', L);
add('PtoD', 'قیمت به سود نقدی', 'valuation', 'ratio', 'lower', L);
add('EVtoEBIT', 'EV/EBIT', 'valuation', 'ratio', 'lower', L);
add('EVtoS', 'EV/S', 'valuation', 'ratio', 'lower', { ...L, aliases: ['EVtoS_Monthly'] });
add('EVtoS_Monthly', 'EV/S بر پایه درآمد ماهانه', 'valuation', 'ratio', 'lower', { horizon: 'month' });
add('DivYield', 'بازده سود نقدی', 'valuation', 'percent', 'higher', L);

// ───────────────────────────── growth: income items ─────────────────────────────
const annualShort: Record<Item, Record<1 | 3 | 5, string>> = {
  Rev: { 1: 'Rev_1YrGR', 3: 'Rev_3YrGR', 5: 'Rev_5YrGR' },
  GP: { 1: 'GP_1YRGR', 3: 'GP_3YrGR', 5: 'GP_5YrGR' },
  OP: { 1: 'OP_1YrGR', 3: 'OP_3YrGR', 5: 'OP_5YrGR' },
  NI: { 1: 'NI_1YRGR', 3: 'NI_3YrGR', 5: 'NI_5YrGR' },
};
for (const k of itemKeys) {
  const name = items[k];
  for (const [n, id] of Object.entries(annualShort[k])) {
    const label = n === '1' ? `رشد سالانه ${name}` : `رشد مرکب ${fa(Number(n))} ساله ${name}`;
    add(id, label, 'growthAnnual', 'percent', 'higher', {
      horizon: 'long',
      description: 'CAGR (فرض PLAN §17).',
    });
  }
  for (const n of [7, 9, 11]) {
    add(`${k}_${n}yrGR`, `رشد مرکب ${fa(n)} ساله ${name}`, 'growthAnnual', 'percent', 'higher', {
      horizon: 'long',
    });
  }
  for (const n of [3, 5, 7, 9, 11]) {
    add(
      `${k}_${n}yrGR_Arith`,
      `میانگین حسابی رشد ${fa(n)} ساله ${name}`,
      'growthAnnual',
      'percent',
      'higher',
      {
        horizon: 'long',
      },
    );
    add(`${k}_${n}qGR`, `رشد مرکب ${fa(n)} فصلی ${name}`, 'growthQuarterly', 'percent', 'higher', {
      horizon: 'quarter',
    });
    add(
      `${k}_${n}qGR_Arith`,
      `میانگین حسابی رشد ${fa(n)} فصلی ${name}`,
      'growthQuarterly',
      'percent',
      'higher',
      {
        horizon: 'quarter',
      },
    );
  }
  add(`${k}QtrlyGR_QoQ`, `رشد فصل به فصل قبل ${name}`, 'growthQuarterly', 'percent', 'higher', {
    horizon: 'quarter',
  });
  add(
    `${k}QtrlyGR_YoY`,
    `رشد فصل نسبت به فصل مشابه سال قبل ${name}`,
    'growthQuarterly',
    'percent',
    'higher',
    {
      horizon: 'quarter',
    },
  );
}

// ───────────────────────────── growth: margins ─────────────────────────────
const margins = { GP: 'حاشیه ناخالص', OP: 'حاشیه عملیاتی', NP: 'حاشیه خالص' } as const;
// The export mixes separators: GP/OP MRQ columns use '-', NP MRQ and all TTM columns use '_'.
const mrqId = (m: keyof typeof margins, suffix: string): string =>
  m === 'NP' ? `NP_Margin_MRQ_${suffix.replace(/-/g, '_')}` : `${m}-Margin-MRQ-${suffix}`;
const ttmId = (m: keyof typeof margins, suffix: string): string =>
  `${m}_Margin_TTM_${suffix.replace(/-/g, '_')}`;

for (const m of Object.keys(margins) as Array<keyof typeof margins>) {
  const name = margins[m];
  const Q = { horizon: 'quarter' } as const;
  for (const n of [3, 5]) {
    add(mrqId(m, `${n}qGR`), `رشد ${fa(n)} فصلی ${name} فصل`, 'growthQuarterly', 'percent', 'higher', Q);
    add(
      mrqId(m, `${n}qGR-Arith`),
      `میانگین حسابی رشد ${fa(n)} فصلی ${name} فصل`,
      'growthQuarterly',
      'percent',
      'higher',
      Q,
    );
    add(ttmId(m, `${n}yGR`), `رشد ${fa(n)} ساله ${name} ۱۲ ماهه`, 'growthAnnual', 'percent', 'higher', L);
    add(
      ttmId(m, `${n}yGR_Arith`),
      `میانگین حسابی رشد ${fa(n)} ساله ${name} ۱۲ ماهه`,
      'growthAnnual',
      'percent',
      'higher',
      L,
    );
  }
  add(mrqId(m, 'QrtlyGR-QoQ'), `تغییر فصل به فصل ${name} فصل`, 'growthQuarterly', 'percent', 'higher', Q);
  add(mrqId(m, 'QrtlyGR-YoY'), `تغییر سالانه ${name} فصل`, 'growthQuarterly', 'percent', 'higher', Q);
  add(ttmId(m, 'QrtlyGR_QoQ'), `تغییر فصلی ${name} ۱۲ ماهه`, 'growthQuarterly', 'percent', 'higher', Q);
  add(
    ttmId(m, 'QrtlyGR_YoY'),
    `تغییر سالانه ${name} ۱۲ ماهه (فصلی)`,
    'growthQuarterly',
    'percent',
    'higher',
    Q,
  );
  add(ttmId(m, '1yGR'), `رشد یک ساله ${name} ۱۲ ماهه`, 'growthAnnual', 'percent', 'higher', L);
}

// ───────────────────────────── growth: monthly ─────────────────────────────
const M = { horizon: 'month' } as const;
for (const n of [1, 3, 5, 7, 9]) {
  add(
    `Rev_${n}MGR`,
    n === 1 ? 'رشد درآمد ماه به ماه قبل' : `رشد درآمد ${fa(n)} ماهه`,
    'growthMonthly',
    'percent',
    'higher',
    M,
  );
  if (n > 1)
    add(
      `Rev_${n}MGR_Arith`,
      `میانگین حسابی رشد درآمد ${fa(n)} ماهه`,
      'growthMonthly',
      'percent',
      'higher',
      M,
    );
}
add('RevCumMonthlyGR_YoY', 'رشد تجمعی درآمد ماهانه نسبت به سال قبل', 'growthMonthly', 'percent', 'higher', M);
add('Prod_Mo3MAvgGR', 'رشد میانگین ۳ ماهه تولید', 'growthMonthly', 'percent', 'higher', M);

// ───────────────────────────── returns ─────────────────────────────
const T = { horizon: 'technical' } as const;
const returns: Array<[string, string]> = [
  ['Ret_1D', 'بازده روزانه'],
  ['Ret_1W', 'بازده یک هفته'],
  ['Ret_1M', 'بازده یک ماه'],
  ['Ret_3M', 'بازده سه ماه'],
  ['Ret_6M', 'بازده شش ماه'],
  ['Ret_YTD', 'بازده از ابتدای سال'],
  ['Ret_1Yr', 'بازده یک سال'],
  ['Ret_3Y', 'بازده سه سال'],
  ['Ret_5Y', 'بازده پنج سال'],
  ['Custom-Return', 'بازده دوره دلخواه'],
];
for (const [id, label] of returns) add(id, label, 'returns', 'percent', 'higher', T);

// ───────────────────────────── risk ─────────────────────────────
const spans = { '90D': '۹۰ روزه', '60W': '۶۰ هفته‌ای', '36M': '۳۶ ماهه' } as const;
for (const [s, label] of Object.entries(spans)) {
  add(`StdDev_${s}`, `انحراف معیار بازده ${label}`, 'risk', 'percent', 'lower', T);
  add(`SemiStdDev_${s}`, `نیم‌انحراف معیار (نزولی) ${label}`, 'risk', 'percent', 'lower', T);
  add(`Beta_${s}`, `بتای ${label}`, 'risk', 'number', 'lower', T);
  add(`Correlation_${s}`, `همبستگی با شاخص ${label}`, 'risk', 'number', 'lower', T);
}
for (const [s, label] of [
  ['1D', 'روزانه'],
  ['1W', 'هفتگی'],
  ['1M', 'ماهانه'],
  ['1Y', 'سالانه'],
]) {
  add(`RelativeRange_${s}`, `دامنه نسبی نوسان ${label}`, 'risk', 'percent', 'lower', T);
}
add('atr', 'میانگین دامنه واقعی (ATR)', 'risk', 'price', 'lower', T);
add('natr', 'ATR نرمال‌شده (٪)', 'risk', 'number', 'lower', T);
add('trange', 'دامنه واقعی روز', 'risk', 'price', 'lower', T);
add('stddev', 'انحراف معیار قیمت', 'risk', 'price', 'lower', T);

// ───────────────────────────── liquidity ─────────────────────────────
add('CurrentVolume', 'حجم معاملات امروز', 'liquidity', 'volume', 'higher', T);
add('CurrentValue', 'ارزش معاملات امروز', 'liquidity', 'rial', 'higher', T);
const windows: Array<[string, string]> = [
  ['3D', '۳ روزه'],
  ['5D', '۵ روزه'],
  ['10D', '۱۰ روزه'],
  ['20D', '۲۰ روزه'],
  ['30D', '۳۰ روزه'],
  ['50D', '۵۰ روزه'],
  ['90D', '۹۰ روزه'],
  ['200D', '۲۰۰ روزه'],
  ['1Yr', 'یک ساله'],
];
for (const [w, label] of windows) {
  add(`AvgVol_${w}`, `میانگین حجم ${label}`, 'liquidity', 'volume', 'higher', T);
  add(`AvgVal_${w}`, `میانگین ارزش معاملات ${label}`, 'liquidity', 'rial', 'higher', T);
}
add('Turnover', 'گردش سهام', 'liquidity', 'number', 'higher', T);
add('TradeRatio', 'نسبت معامله', 'liquidity', 'number', 'higher', T);
add('Amihud_30d', 'شاخص عدم نقدشوندگی آمیهود ۳۰ روزه', 'liquidity', 'number', 'lower', T);
add('Amihud_90d', 'شاخص عدم نقدشوندگی آمیهود ۹۰ روزه', 'liquidity', 'number', 'lower', T);

// ───────────────────────────── money flow ─────────────────────────────
add('IndividualPerCapital', 'سرانه خرید حقیقی', 'flow', 'rial', 'higher', T);
add('InstitutionalPerCapital', 'سرانه خرید حقوقی', 'flow', 'rial', 'neutral', T);
add('IndividualBuyPower', 'قدرت خریدار حقیقی', 'flow', 'ratio', 'higher', {
  ...T,
  description: 'سرانه خرید حقیقی ÷ سرانه فروش حقیقی (فرض PLAN §17).',
});
add('InstitutionalBuyPower', 'قدرت خریدار حقوقی', 'flow', 'ratio', 'neutral', T);
add('NetIndividualVolume', 'خالص حجم ورود حقیقی', 'flow', 'volume', 'higher', T);
add('NetIndividualValue', 'خالص ارزش ورود پول حقیقی', 'flow', 'rial', 'higher', T);
add('NetIndividual', 'خالص ورود حقیقی به ارزش معاملات', 'flow', 'percent', 'higher', T);
add('NetInstitutionalVolume', 'خالص حجم ورود حقوقی', 'flow', 'volume', 'neutral', T);
add('NetInstitutionalValue', 'خالص ارزش ورود حقوقی', 'flow', 'rial', 'neutral', T);
add('NetInstitutional', 'خالص ورود حقوقی به ارزش معاملات', 'flow', 'percent', 'neutral', T);
add('BidPressure', 'فشار تقاضا', 'flow', 'number', 'higher', T);

// ───────────────────────────── technical: trend ─────────────────────────────
for (const n of [20, 50, 100, 200]) {
  add(`SMA_${n}D`, `میانگین متحرک ساده ${fa(n)} روزه`, 'technicalTrend', 'price', 'neutral', T);
  add(`EMA_${n}D`, `میانگین متحرک نمایی ${fa(n)} روزه`, 'technicalTrend', 'price', 'neutral', T);
  add(`dema${n}`, `DEMA ${fa(n)}`, 'technicalTrend', 'price', 'neutral', T);
  add(`tema${n}`, `TEMA ${fa(n)}`, 'technicalTrend', 'price', 'neutral', T);
  add(`wma${n}`, `WMA ${fa(n)}`, 'technicalTrend', 'price', 'neutral', T);
  add(`trima${n}`, `TRIMA ${fa(n)}`, 'technicalTrend', 'price', 'neutral', T);
}
const trend: Array<[string, string, Unit, Direction]> = [
  ['kama30', 'KAMA ۳۰', 'price', 'neutral'],
  ['mama', 'MAMA', 'price', 'neutral'],
  ['fama', 'FAMA', 'price', 'neutral'],
  ['adx', 'ADX (قدرت روند)', 'number', 'higher'],
  ['adxr', 'ADXR', 'number', 'higher'],
  ['dx', 'DX', 'number', 'neutral'],
  ['plus_di', '+DI', 'number', 'higher'],
  ['minus_di', '−DI', 'number', 'lower'],
  ['plus_dm', '+DM', 'number', 'neutral'],
  ['minus_dm', '−DM', 'number', 'neutral'],
  ['aroonup', 'آرون بالا', 'number', 'higher'],
  ['aroondown', 'آرون پایین', 'number', 'lower'],
  ['aroonosc', 'نوسان‌گر آرون', 'number', 'higher'],
  ['sar', 'Parabolic SAR', 'price', 'neutral'],
  ['linearreg', 'رگرسیون خطی', 'price', 'neutral'],
  ['linearreg_angle', 'زاویه رگرسیون خطی', 'number', 'higher'],
  ['linearreg_intercept', 'عرض از مبدأ رگرسیون', 'price', 'neutral'],
  ['linearreg_slope', 'شیب رگرسیون خطی', 'number', 'higher'],
  ['tsf', 'پیش‌بینی سری زمانی (TSF)', 'price', 'neutral'],
  ['ht_trendmode', 'حالت روند هیلبرت', 'flag', 'neutral'],
];
for (const [id, label, unit, dir] of trend) add(id, label, 'technicalTrend', unit, dir, T);

// ───────────────────────────── technical: momentum ─────────────────────────────
const momentum: Array<[string, string, Direction, string[]?]> = [
  ['RSI', 'شاخص قدرت نسبی (RSI)', 'band'],
  ['macd', 'MACD', 'higher', ['MACDLine']],
  ['MACDLine', 'خط MACD', 'higher', ['macd']],
  ['macdsignal', 'سیگنال MACD', 'neutral', ['MACDSignalLine']],
  ['MACDSignalLine', 'خط سیگنال MACD', 'neutral', ['macdsignal']],
  ['macdHistogram', 'هیستوگرام MACD', 'higher'],
  ['ppo', 'PPO', 'higher'],
  ['apo', 'APO', 'higher'],
  ['mom', 'مومنتوم', 'higher'],
  ['roc', 'نرخ تغییر (ROC)', 'higher'],
  ['rocp', 'ROCP', 'higher'],
  ['rocr', 'ROCR', 'higher'],
  ['rocr100', 'ROCR100', 'higher'],
  ['cci', 'CCI', 'band'],
  ['cmo', 'CMO', 'higher'],
  ['trix', 'TRIX', 'higher'],
  ['stochastic_fastk', 'استوکاستیک سریع %K', 'band'],
  ['stochastic_fastd', 'استوکاستیک سریع %D', 'band'],
  ['stochastic_slowk', 'استوکاستیک کند %K', 'band'],
  ['stochastic_slowd', 'استوکاستیک کند %D', 'band'],
  ['stochastic_rsi_k', 'Stoch RSI %K', 'band'],
  ['stochastic_rsi_d', 'Stoch RSI %D', 'band'],
  ['willr', 'ویلیامز %R', 'band'],
  ['ultosc', 'نوسان‌گر نهایی', 'band'],
  ['DeMarker', 'دیمارکر', 'band'],
  ['bop', 'توازن قدرت (BOP)', 'higher'],
];
for (const [id, label, dir, aliases] of momentum) {
  add(id, label, 'technicalMomentum', 'number', dir, aliases ? { ...T, aliases } : T);
}

// ───────────────────────────── technical: volume ─────────────────────────────
add('obv', 'حجم تعادلی (OBV)', 'technicalVolume', 'volume', 'higher', T);
add('ad', 'انباشت/توزیع (A/D)', 'technicalVolume', 'volume', 'higher', T);
add('adosc', 'نوسان‌گر چایکین', 'technicalVolume', 'volume', 'higher', T);
add('MFI', 'شاخص جریان پول (MFI)', 'technicalVolume', 'number', 'band', T);

// ───────────────────────────── technical: levels ─────────────────────────────
add('bubands', 'باند بالای بولینگر', 'technicalLevels', 'price', 'neutral', { ...T, aliases: ['beubands'] });
add('bmbands', 'باند میانی بولینگر', 'technicalLevels', 'price', 'neutral', { ...T, aliases: ['bembands'] });
add('blbands', 'باند پایین بولینگر', 'technicalLevels', 'price', 'neutral', { ...T, aliases: ['belbands'] });
add('beubands', 'باند بالای بولینگر (EMA)', 'technicalLevels', 'price', 'neutral', {
  ...T,
  aliases: ['bubands'],
});
add('bembands', 'باند میانی بولینگر (EMA)', 'technicalLevels', 'price', 'neutral', {
  ...T,
  aliases: ['bmbands'],
});
add('belbands', 'باند پایین بولینگر (EMA)', 'technicalLevels', 'price', 'neutral', {
  ...T,
  aliases: ['blbands'],
});
for (const n of [20, 50, 100, 200]) {
  add(`midpoint${n}`, `نقطه میانی ${fa(n)}`, 'technicalLevels', 'price', 'neutral', T);
  add(`midprice${n}`, `قیمت میانی ${fa(n)}`, 'technicalLevels', 'price', 'neutral', T);
}
for (const n of [20, 50, 200]) {
  add(`High_${n}D`, `قیمت به سقف ${fa(n)} روزه`, 'technicalLevels', 'ratio', 'higher', {
    ...T,
    description: `Price ÷ سقف ${fa(n)} روزه؛ ۱ یعنی روی سقف.`,
  });
  add(`Low_${n}D`, `قیمت به کف ${fa(n)} روزه`, 'technicalLevels', 'ratio', 'neutral', {
    ...T,
    description: `Price ÷ کف ${fa(n)} روزه؛ ۱ یعنی روی کف.`,
  });
}
const pivots: Record<string, { label: string; levels: string[] }> = {
  standard: { label: 'استاندارد', levels: ['p', 's1', 's2', 's3', 'r1', 'r2', 'r3'] },
  fibonacci: { label: 'فیبوناچی', levels: ['p', 's1', 's2', 's3', 'r1', 'r2', 'r3'] },
  demark: { label: 'دیمارک', levels: ['p', 's1', 'r1'] },
  camarilla: { label: 'کاماریلا', levels: ['p', 's1', 's2', 's3', 'r1', 'r2', 'r3'] },
  woodie: { label: 'وودی', levels: ['p', 's1', 's2', 's3', 'r1', 'r2', 'r3'] },
};
const levelLabel = (lv: string): string =>
  lv === 'p' ? 'پیوت' : `${lv[0] === 's' ? 'حمایت' : 'مقاومت'} ${fa(Number(lv.slice(1)))}`;
for (const [kind, { label, levels }] of Object.entries(pivots)) {
  for (const lv of levels)
    add(`pp_${kind}_${lv}`, `${levelLabel(lv)} (${label})`, 'technicalLevels', 'price', 'neutral', T);
}

// ───────────────────────────── technical: cycle ─────────────────────────────
const cycle: Array<[string, string]> = [
  ['ht_dcperiod', 'دوره چرخه هیلبرت'],
  ['ht_dcphase', 'فاز چرخه هیلبرت'],
  ['ht_phasor_inphase', 'فازور هیلبرت (هم‌فاز)'],
  ['ht_phasor_quadrature', 'فازور هیلبرت (تربیعی)'],
  ['ht_sine', 'سینوس هیلبرت'],
  ['ht_sine_leadsine', 'سینوس پیشرو هیلبرت'],
];
for (const [id, label] of cycle) add(id, label, 'technicalCycle', 'number', 'neutral', T);

export const columnDefs: readonly ColumnDef[] = defs;

export const columnDictionary: ReadonlyMap<string, ColumnDef> = new Map(defs.map((d) => [d.id, d]));

/** Columns stored as text, never coerced to numbers. */
export const textColumns: ReadonlySet<string> = new Set(
  defs.filter((d) => d.kind === 'text').map((d) => d.id),
);

/** Columns ignored entirely (no information). */
export const ignoredColumns: ReadonlySet<string> = new Set(['Chart']);

export const categoryLabels: Record<Category, string> = {
  identity: 'شناسه',
  price: 'قیمت',
  size: 'اندازه',
  incomeAnnual: 'سود و زیان سالانه',
  incomeQuarterly: 'سود و زیان فصلی',
  incomeMonthly: 'درآمد ماهانه',
  balance: 'ترازنامه',
  ratioProfitability: 'سودآوری',
  ratioEfficiency: 'کارایی',
  ratioLeverage: 'اهرم و نقدینگی',
  ratioCashflow: 'جریان نقد',
  valuation: 'ارزش‌گذاری',
  growthAnnual: 'رشد سالانه',
  growthQuarterly: 'رشد فصلی',
  growthMonthly: 'رشد ماهانه',
  returns: 'بازده',
  risk: 'ریسک',
  liquidity: 'نقدشوندگی',
  flow: 'جریان پول',
  technicalTrend: 'تکنیکال: روند',
  technicalMomentum: 'تکنیکال: مومنتوم',
  technicalVolume: 'تکنیکال: حجم',
  technicalLevels: 'تکنیکال: سطوح',
  technicalCycle: 'تکنیکال: چرخه',
  derived: 'پارامتر مشتق',
  custom: 'پارامتر سفارشی',
  score: 'امتیاز',
  uncategorized: 'دسته‌بندی‌نشده',
};

export const exchangeLabels: Record<string, string> = { TSE: 'بورس', IFB: 'فرابورس', OTC: 'پایه' };

export const UNKNOWN_SECTOR = 'نامشخص';
