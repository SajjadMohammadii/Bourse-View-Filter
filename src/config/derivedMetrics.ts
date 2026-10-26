import type { Direction, Horizon, Unit } from '../core/types';
import type { MetricContext, MetricDef, RowAccessor } from '../core/metrics/types';
import {
  NEGATIVE_BASE,
  abs,
  add,
  boolMean,
  coalesce,
  divAbs,
  divPositiveBase,
  gt,
  isNum,
  mul,
  relChange,
  safeDiv,
  sub,
  realGrowth,
  type Num,
} from '../core/metrics/helpers';
import { daysBetween, fromCompact } from '../core/utils/jalali';
import { thresholds } from './assumptions';

/** System derived metrics (PLAN.md §5.2). Add a metric here + a unit test; engines stay unchanged. */

type Compute = (r: RowAccessor, ctx: MetricContext) => Num;

function m(
  id: string,
  label: string,
  unit: Unit,
  direction: Direction,
  horizon: Horizon,
  requires: string[],
  compute: Compute,
  description: string,
): MetricDef {
  return { id, label, category: 'derived', unit, direction, horizon, requires, compute, description };
}

const EPS = 1e-9;
const g = (r: RowAccessor, id: string): Num => r.get(id);

// ───────────── الف) balance sheet, leverage, liquidity ─────────────
const leverage: MetricDef[] = [
  m(
    'D_Debt',
    'بدهی مالی (تسهیلات)',
    'rial',
    'neutral',
    'long',
    ['DebtRatio', 'TA_MRQ'],
    (r) => mul(g(r, 'DebtRatio'), g(r, 'TA_MRQ')),
    'DebtRatio × TA_MRQ',
  ),
  m(
    'D_DebtToRev',
    'بدهی مالی به فروش',
    'ratio',
    'lower',
    'long',
    ['D_Debt', 'Rev_TTM'],
    (r) => safeDiv(g(r, 'D_Debt'), g(r, 'Rev_TTM')),
    'D_Debt / Rev_TTM — کمتر بهتر',
  ),
  m(
    'D_TLToRev',
    'کل بدهی به فروش',
    'ratio',
    'lower',
    'long',
    ['TL_MRQ', 'Rev_TTM'],
    (r) => safeDiv(g(r, 'TL_MRQ'), g(r, 'Rev_TTM')),
    'TL_MRQ / Rev_TTM — کمتر بهتر',
  ),
  m(
    'D_DebtToMcap',
    'بدهی مالی به ارزش بازار',
    'ratio',
    'lower',
    'long',
    ['D_Debt', 'MarketCap'],
    (r) => safeDiv(g(r, 'D_Debt'), g(r, 'MarketCap')),
    'D_Debt / MarketCap — کمتر بهتر',
  ),
  m(
    'D_EV',
    'ارزش شرکت (تقریبی)',
    'rial',
    'neutral',
    'long',
    ['MarketCap', 'D_Debt'],
    (r) => add(g(r, 'MarketCap'), coalesce(g(r, 'D_Debt'), 0)),
    'MarketCap + D_Debt (بدون کسر وجه نقد)',
  ),
  m(
    'D_DebtToOP',
    'سال‌های بازپرداخت بدهی با سود عملیاتی',
    'ratio',
    'lower',
    'long',
    ['D_Debt', 'OP_TTM'],
    (r) => (g(r, 'D_Debt') === 0 ? 0 : divPositiveBase(g(r, 'D_Debt'), g(r, 'OP_TTM'))),
    'D_Debt / OP_TTM؛ سود عملیاتی ≤ ۰ ← پایه منفی (بدترین) — کمتر بهتر',
  ),
  m(
    'D_FEtoOP',
    'هزینه مالی به سود عملیاتی',
    'percent',
    'lower',
    'long',
    ['FE_TTM', 'OP_TTM'],
    (r) => (g(r, 'FE_TTM') === 0 ? 0 : divPositiveBase(g(r, 'FE_TTM'), g(r, 'OP_TTM'))),
    'FE_TTM / OP_TTM؛ سود عملیاتی ≤ ۰ ← پایه منفی — کمتر بهتر',
  ),
  m(
    'D_FEtoRev',
    'هزینه مالی به فروش',
    'percent',
    'lower',
    'long',
    ['FE_TTM', 'Rev_TTM'],
    (r) => safeDiv(g(r, 'FE_TTM'), g(r, 'Rev_TTM')),
    'FE_TTM / Rev_TTM — کمتر بهتر',
  ),
  m(
    'D_EquityToAsset',
    'نسبت مالکانه',
    'percent',
    'higher',
    'long',
    ['TSE_MRQ', 'TA_MRQ'],
    (r) => safeDiv(g(r, 'TSE_MRQ'), g(r, 'TA_MRQ')),
    'TSE_MRQ / TA_MRQ — بیشتر بهتر',
  ),
  m(
    'D_ROIC',
    'بازده سرمایه به‌کاررفته (تقریبی)',
    'percent',
    'higher',
    'long',
    ['EBIT', 'OP_TTM', 'ETR', 'TSE_MRQ', 'D_Debt'],
    (r) =>
      divPositiveBase(
        mul(coalesce(g(r, 'EBIT'), g(r, 'OP_TTM')), 1 - (coalesce(g(r, 'ETR'), 0) as number)),
        add(g(r, 'TSE_MRQ'), coalesce(g(r, 'D_Debt'), 0)),
      ),
    'EBIT × (1 − ETR) / (TSE_MRQ + D_Debt)؛ EBIT خالی ← OP_TTM؛ سرمایه ≤ ۰ ← پایه منفی',
  ),
  m(
    'D_AltmanZ_approx',
    'Altman Z تعدیل‌شده',
    'number',
    'higher',
    'long',
    ['EBIT', 'OP_TTM', 'TA_MRQ', 'MarketCap', 'TL_MRQ', 'Rev_TTM', 'RE_MRQ'],
    altmanZ,
    '3.3·EBIT/TA + 0.6·MarketCap/TL + 1.0·Rev_TTM/TA + 1.4·RE/TA (بدون جزء سرمایه در گردش) — بیشتر بهتر',
  ),
  m(
    'D_CCC_approx',
    'چرخه تبدیل (تقریبی)',
    'days',
    'lower',
    'long',
    ['InvTurnoverDay', 'ReceivableTurnoverDay'],
    (r) => add(g(r, 'InvTurnoverDay'), g(r, 'ReceivableTurnoverDay')),
    'InvTurnoverDay + ReceivableTurnoverDay (بدون دوره پرداخت) — کمتر بهتر',
  ),
];

function altmanZ(r: RowAccessor): Num {
  const ta = g(r, 'TA_MRQ');
  if (!isNum(ta) || ta <= 0) return null;
  const ebit = coalesce(g(r, 'EBIT'), g(r, 'OP_TTM'));
  const parts = [
    mul(3.3, safeDiv(ebit, ta)),
    mul(0.6, safeDiv(g(r, 'MarketCap'), g(r, 'TL_MRQ'))),
    mul(1.0, safeDiv(g(r, 'Rev_TTM'), ta)),
    mul(1.4, safeDiv(g(r, 'RE_MRQ'), ta)),
  ];
  return add(...parts);
}

// ───────────── ب) earnings quality & cash flow ─────────────
const quality: MetricDef[] = [
  m(
    'D_CFO',
    'جریان نقد عملیاتی ۱۲ ماهه',
    'rial',
    'higher',
    'long',
    ['CFOToRev', 'Rev_TTM'],
    (r) => mul(g(r, 'CFOToRev'), g(r, 'Rev_TTM')),
    'CFOToRev × Rev_TTM',
  ),
  m(
    'D_CFOtoNI',
    'کیفیت سود (نقد به سود)',
    'ratio',
    'band',
    'long',
    ['D_CFO', 'NI_TTM'],
    (r) =>
      isNum(g(r, 'NI_TTM')) && (g(r, 'NI_TTM') as number) > 0 ? safeDiv(g(r, 'D_CFO'), g(r, 'NI_TTM')) : null,
    'D_CFO / NI_TTM (فقط برای سود مثبت) — باند مطلوب ۰٫۸ تا ۲',
  ),
  m(
    'D_Accruals',
    'اقلام تعهدی به دارایی',
    'percent',
    'lower',
    'long',
    ['NI_TTM', 'D_CFO', 'TA_MRQ'],
    (r) => safeDiv(sub(g(r, 'NI_TTM'), g(r, 'D_CFO')), g(r, 'TA_MRQ')),
    '(NI_TTM − D_CFO) / TA_MRQ — کمتر بهتر',
  ),
  m(
    'D_FCFF',
    'جریان نقد آزاد شرکت',
    'rial',
    'higher',
    'long',
    ['FCFFToRev', 'Rev_TTM'],
    (r) => mul(g(r, 'FCFFToRev'), g(r, 'Rev_TTM')),
    'FCFFToRev × Rev_TTM',
  ),
  m(
    'D_FCFFYield',
    'بازده جریان نقد آزاد',
    'percent',
    'higher',
    'long',
    ['D_FCFF', 'MarketCap'],
    (r) => safeDiv(g(r, 'D_FCFF'), g(r, 'MarketCap')),
    'D_FCFF / MarketCap — بیشتر بهتر',
  ),
  m(
    'D_FxShareNI',
    'سهم سود/زیان ارزی از سود',
    'percent',
    'neutral',
    'long',
    ['NetFx_IRR', 'NI_TTM'],
    (r) => divAbs(g(r, 'NetFx_IRR'), g(r, 'NI_TTM')),
    'NetFx_IRR / |NI_TTM| — نزدیک صفر بهتر',
  ),
];

// ───────────── ج) valuation ─────────────
const valuation: MetricDef[] = [
  m(
    'D_PE_ttm',
    'P/E ۱۲ ماهه (زیان = بدترین)',
    'ratio',
    'lower',
    'long',
    ['MarketCap', 'NI_TTM'],
    (r) => divPositiveBase(g(r, 'MarketCap'), g(r, 'NI_TTM')),
    'MarketCap / NI_TTM؛ برخلاف PtoE_ttm خام، زیان‌ده‌ها پایه منفی (بدترین) می‌گیرند — کمتر بهتر',
  ),
  m(
    'D_EarningsYield',
    'بازده سود',
    'percent',
    'higher',
    'long',
    ['NI_TTM', 'MarketCap'],
    (r) => safeDiv(g(r, 'NI_TTM'), g(r, 'MarketCap')),
    'NI_TTM / MarketCap — بیشتر بهتر',
  ),
  m(
    'D_EYSpread',
    'اسپرد بازده سود به نرخ بدون ریسک',
    'percent',
    'higher',
    'long',
    ['D_EarningsYield'],
    (r, ctx) => sub(g(r, 'D_EarningsYield'), ctx.assumptions.riskFreeRate),
    'D_EarningsYield − نرخ بدون ریسک (تنظیمات) — بیشتر بهتر',
  ),
  m(
    'D_PEG_approx',
    'PEG تقریبی',
    'ratio',
    'lower',
    'long',
    ['PtoE_ttm', 'NI_3YrGR', 'NI_TTM'],
    peg,
    'PtoE_ttm / (رشد واقعی NI_3YrGR × ۱۰۰)؛ رشد ≤ ۰ یا زیان ← پایه منفی — کمتر بهتر',
  ),
  m(
    'D_OPYieldEV',
    'بازده عملیاتی بر EV',
    'percent',
    'higher',
    'long',
    ['OP_TTM', 'D_EV'],
    (r) => safeDiv(g(r, 'OP_TTM'), g(r, 'D_EV')),
    'OP_TTM / D_EV — بیشتر بهتر',
  ),
];

function peg(r: RowAccessor, ctx: MetricContext): Num {
  const ni = g(r, 'NI_TTM');
  if (isNum(ni) && ni <= 0) return NEGATIVE_BASE;
  const growth = realGrowth(g(r, 'NI_3YrGR'), ctx.assumptions.inflation);
  const pe = g(r, 'PtoE_ttm');
  if (!isNum(growth) || !isNum(pe)) return null;
  return growth <= 0 ? NEGATIVE_BASE : pe / (growth * 100);
}

// ───────────── د) balance-sheet trend (MRQ vs FY) ─────────────
const trend: MetricDef[] = [
  m(
    'D_dTL',
    'رشد بدهی از پایان سال',
    'percent',
    'lower',
    'quarter',
    ['TL_MRQ', 'TL_FY'],
    (r) => relChange(g(r, 'TL_MRQ'), g(r, 'TL_FY')),
    'TL_MRQ / TL_FY − 1 — کمتر بهتر',
  ),
  m(
    'D_dTA',
    'رشد دارایی از پایان سال',
    'percent',
    'higher',
    'quarter',
    ['TA_MRQ', 'TA_FY'],
    (r) => relChange(g(r, 'TA_MRQ'), g(r, 'TA_FY')),
    'TA_MRQ / TA_FY − 1 — بیشتر بهتر',
  ),
  m(
    'D_dEquity',
    'رشد حقوق صاحبان سهام',
    'percent',
    'higher',
    'quarter',
    ['TSE_MRQ', 'TSE_FY'],
    (r) => relChange(g(r, 'TSE_MRQ'), g(r, 'TSE_FY')),
    '(TSE_MRQ − TSE_FY) / |TSE_FY| — بیشتر بهتر',
  ),
  m(
    'D_dLevGap',
    'تغییر نسبت بدهی',
    'percent',
    'lower',
    'quarter',
    ['TL_MRQ', 'TA_MRQ', 'TL_FY', 'TA_FY'],
    (r) => sub(safeDiv(g(r, 'TL_MRQ'), g(r, 'TA_MRQ')), safeDiv(g(r, 'TL_FY'), g(r, 'TA_FY'))),
    'TL_MRQ/TA_MRQ − TL_FY/TA_FY — کمتر بهتر',
  ),
  m(
    'D_dRE',
    'تغییر سود انباشته به دارایی',
    'percent',
    'higher',
    'quarter',
    ['RE_MRQ', 'RE_FY', 'TA_MRQ'],
    (r) => safeDiv(sub(g(r, 'RE_MRQ'), g(r, 'RE_FY')), g(r, 'TA_MRQ')),
    '(RE_MRQ − RE_FY) / TA_MRQ — بیشتر بهتر',
  ),
];

// ───────────── ه) quarterly ─────────────
const annualQ = (r: RowAccessor, id: string): Num => mul(g(r, id), 4);
const quarterly: MetricDef[] = [
  m(
    'D_NI_MRQ_toTTM',
    'سهم سود فصل آخر از سود ۱۲ ماهه',
    'percent',
    'higher',
    'quarter',
    ['NI_MRQ', 'NI_TTM'],
    (r) => divAbs(g(r, 'NI_MRQ'), g(r, 'NI_TTM')),
    'NI_MRQ / |NI_TTM| (خنثی ≈ ۰٫۲۵) — بیشتر بهتر',
  ),
  m(
    'D_NI_MRQ_toFY',
    'نسبت سود فصل آخر به سود سال مالی',
    'percent',
    'higher',
    'quarter',
    ['NI_MRQ', 'NI_FY'],
    (r) => divAbs(g(r, 'NI_MRQ'), g(r, 'NI_FY')),
    'NI_MRQ / |NI_FY| — بیشتر بهتر',
  ),
  m(
    'D_NI_RunRate',
    'سود فصل سالانه‌شده به سود ۱۲ ماهه',
    'ratio',
    'higher',
    'quarter',
    ['NI_MRQ', 'NI_TTM'],
    (r) => divAbs(annualQ(r, 'NI_MRQ'), g(r, 'NI_TTM')),
    'NI_MRQ × 4 / |NI_TTM| — بیشتر بهتر',
  ),
  m(
    'D_Rev_RunRateQ',
    'فروش فصل سالانه‌شده به فروش ۱۲ ماهه',
    'ratio',
    'higher',
    'quarter',
    ['Rev_MRQ', 'Rev_TTM'],
    (r) => safeDiv(annualQ(r, 'Rev_MRQ'), g(r, 'Rev_TTM')),
    'Rev_MRQ × 4 / Rev_TTM — بیشتر بهتر',
  ),
  m(
    'D_FwdEY_Q',
    'سود فصل سالانه‌شده به ارزش بازار',
    'percent',
    'higher',
    'quarter',
    ['NI_MRQ', 'MarketCap'],
    (r) => safeDiv(annualQ(r, 'NI_MRQ'), g(r, 'MarketCap')),
    'NI_MRQ × 4 / MarketCap — بیشتر بهتر',
  ),
  m(
    'D_FwdPE_Q',
    'P/E پیش‌رو بر پایه فصل',
    'ratio',
    'lower',
    'quarter',
    ['MarketCap', 'NI_MRQ'],
    (r) => divPositiveBase(g(r, 'MarketCap'), annualQ(r, 'NI_MRQ')),
    'MarketCap / (NI_MRQ × 4)؛ زیان فصل ← پایه منفی — کمتر بهتر',
  ),
  m(
    'D_RevYield_Q',
    'فروش فصل سالانه‌شده به ارزش بازار',
    'ratio',
    'higher',
    'quarter',
    ['Rev_MRQ', 'MarketCap'],
    (r) => safeDiv(annualQ(r, 'Rev_MRQ'), g(r, 'MarketCap')),
    'Rev_MRQ × 4 / MarketCap — بیشتر بهتر',
  ),
  m(
    'D_OPYield_Q',
    'سود عملیاتی فصل سالانه‌شده به EV',
    'percent',
    'higher',
    'quarter',
    ['OP_MRQ', 'D_EV'],
    (r) => safeDiv(annualQ(r, 'OP_MRQ'), g(r, 'D_EV')),
    'OP_MRQ × 4 / D_EV — بیشتر بهتر',
  ),
  m(
    'D_dNPMargin_Q',
    'بهبود حاشیه خالص فصل نسبت به ۱۲ ماهه',
    'percent',
    'higher',
    'quarter',
    ['NPMarginMRQ', 'NPMargin'],
    (r) => sub(g(r, 'NPMarginMRQ'), g(r, 'NPMargin')),
    'NPMarginMRQ − NPMargin — بیشتر بهتر',
  ),
  m(
    'D_dGPMargin_Q',
    'بهبود حاشیه ناخالص فصل',
    'percent',
    'higher',
    'quarter',
    ['GPMarginMRQ', 'GPMargin'],
    (r) => sub(g(r, 'GPMarginMRQ'), g(r, 'GPMargin')),
    'GPMarginMRQ − GPMargin — بیشتر بهتر',
  ),
  m(
    'D_dOPMargin_Q',
    'بهبود حاشیه عملیاتی فصل',
    'percent',
    'higher',
    'quarter',
    ['OPMarginMRQ', 'OPMargin'],
    (r) => sub(g(r, 'OPMarginMRQ'), g(r, 'OPMargin')),
    'OPMarginMRQ − OPMargin — بیشتر بهتر',
  ),
  m(
    'D_DebtToRev_Q',
    'بدهی مالی به فروش فصل سالانه‌شده',
    'ratio',
    'lower',
    'quarter',
    ['D_Debt', 'Rev_MRQ'],
    (r) => safeDiv(g(r, 'D_Debt'), annualQ(r, 'Rev_MRQ')),
    'D_Debt / (Rev_MRQ × 4) — کمتر بهتر',
  ),
  m(
    'D_FEtoOP_Q',
    'هزینه مالی فصل به سود عملیاتی فصل',
    'percent',
    'lower',
    'quarter',
    ['FE_MRQ', 'OP_MRQ'],
    (r) => (g(r, 'FE_MRQ') === 0 ? 0 : divPositiveBase(g(r, 'FE_MRQ'), g(r, 'OP_MRQ'))),
    'FE_MRQ / OP_MRQ؛ سود عملیاتی فصل ≤ ۰ ← پایه منفی — کمتر بهتر',
  ),
  m(
    'D_NonOpShare_Q',
    'سهم سود غیرعملیاتی فصل',
    'percent',
    'lower',
    'quarter',
    ['NI_MRQ', 'OP_MRQ', 'FE_MRQ', 'ETR'],
    nonOpShare,
    '(NI_MRQ − OP_MRQ×(1−ETR) + FE_MRQ×(1−ETR)) / |NI_MRQ| — کمتر بهتر (کیفیت)',
  ),
  m(
    'D_NI_PrevQ_est',
    'تخمین سود فصل قبل',
    'rial',
    'neutral',
    'quarter',
    ['NI_MRQ', 'NIQtrlyGR_QoQ'],
    (r) => safeDiv(g(r, 'NI_MRQ'), add(1, g(r, 'NIQtrlyGR_QoQ'))),
    'NI_MRQ / (1 + NIQtrlyGR_QoQ)',
  ),
  m(
    'D_StatementAgeDays',
    'عمر آخرین صورت مالی',
    'days',
    'lower',
    'quarter',
    ['LastStatementDate'],
    statementAge,
    'تاریخ اسنپ‌شات − LastStatementDate (روز) — کمتر بهتر',
  ),
  m(
    'D_FxShareNI_Q',
    'سهم سود/زیان ارزی از سود فصل',
    'percent',
    'neutral',
    'quarter',
    ['NetFx_IRR', 'NI_MRQ'],
    (r) => divAbs(g(r, 'NetFx_IRR'), g(r, 'NI_MRQ')),
    'NetFx_IRR / |NI_MRQ| — نزدیک صفر بهتر',
  ),
];

function nonOpShare(r: RowAccessor): Num {
  const keep = 1 - (coalesce(g(r, 'ETR'), 0) as number);
  const core = sub(mul(g(r, 'OP_MRQ'), keep), mul(coalesce(g(r, 'FE_MRQ'), 0), keep));
  return divAbs(sub(g(r, 'NI_MRQ'), core), g(r, 'NI_MRQ'));
}

function statementAge(r: RowAccessor, ctx: MetricContext): Num {
  const raw = g(r, 'LastStatementDate');
  const last = isNum(raw) ? fromCompact(raw) : null;
  if (!last || !ctx.snapshotDate) return null;
  return daysBetween(last, ctx.snapshotDate);
}

// ───────────── و) monthly ─────────────
const monthly: MetricDef[] = [
  m(
    'D_Rev1M_toAvg12',
    'درآمد ماه آخر به میانگین ماهانه ۱۲ ماه',
    'ratio',
    'higher',
    'month',
    ['Rev_1M', 'Rev_TTM'],
    (r) => safeDiv(g(r, 'Rev_1M'), safeDiv(g(r, 'Rev_TTM'), 12)),
    'Rev_1M / (Rev_TTM / 12) — بیشتر بهتر',
  ),
  m(
    'D_Rev1M_toAvg12_real',
    'درآمد ماه آخر به میانگین ۱۲ ماه (واقعی)',
    'ratio',
    'higher',
    'month',
    ['D_Rev1M_toAvg12'],
    (r, ctx) =>
      safeDiv(
        g(r, 'D_Rev1M_toAvg12'),
        Math.pow(1 + ctx.assumptions.inflation, thresholds.ttmMidpointMonths / 12),
      ),
    'D_Rev1M_toAvg12 / (1+π)^(6.5/12)؛ بیشتر از ۱ یعنی رشد واقعی',
  ),
  m(
    'D_Rev1M_toQAvg',
    'درآمد ماه آخر به میانگین ماهانه فصل آخر',
    'ratio',
    'higher',
    'month',
    ['Rev_1M', 'Rev_MRQ'],
    (r) => safeDiv(g(r, 'Rev_1M'), safeDiv(g(r, 'Rev_MRQ'), 3)),
    'Rev_1M / (Rev_MRQ / 3) — بیشتر بهتر',
  ),
  m(
    'D_Rev1M_toFYAvg',
    'درآمد ماه آخر به میانگین ماهانه سال مالی',
    'ratio',
    'higher',
    'month',
    ['Rev_1M', 'Rev_FY'],
    (r) => safeDiv(g(r, 'Rev_1M'), safeDiv(g(r, 'Rev_FY'), 12)),
    'Rev_1M / (Rev_FY / 12) — بیشتر بهتر',
  ),
  m(
    'D_Rev1M_toNI_FY',
    'درآمد ماه به سود سال',
    'ratio',
    'higher',
    'month',
    ['Rev_1M', 'NI_FY'],
    (r) =>
      isNum(g(r, 'NI_FY')) && (g(r, 'NI_FY') as number) > 0 ? safeDiv(g(r, 'Rev_1M'), g(r, 'NI_FY')) : null,
    'Rev_1M / NI_FY (فقط سود سال مثبت) — اهرم درآمد بر سود',
  ),
  m(
    'D_RevYield_M',
    'درآمد ماه سالانه‌شده به ارزش بازار',
    'ratio',
    'higher',
    'month',
    ['Rev_1M', 'MarketCap'],
    (r) => safeDiv(mul(g(r, 'Rev_1M'), 12), g(r, 'MarketCap')),
    'Rev_1M × 12 / MarketCap — بیشتر بهتر',
  ),
  m(
    'D_ImpliedNI_M',
    'سود ضمنی سالانه از درآمد ماه',
    'rial',
    'higher',
    'month',
    ['Rev_1M', 'NPMarginMRQ', 'NPMargin'],
    (r) => mul(g(r, 'Rev_1M'), 12, coalesce(g(r, 'NPMarginMRQ'), g(r, 'NPMargin'))),
    'Rev_1M × 12 × NPMarginMRQ (اگر خالی: NPMargin)',
  ),
  m(
    'D_ImpliedPE_M',
    'P/E ضمنی ماهانه',
    'ratio',
    'lower',
    'month',
    ['MarketCap', 'D_ImpliedNI_M'],
    (r) => divPositiveBase(g(r, 'MarketCap'), g(r, 'D_ImpliedNI_M')),
    'MarketCap / D_ImpliedNI_M؛ سود ضمنی ≤ ۰ ← پایه منفی',
  ),
  m(
    'D_ImpliedEarnGrowth_M',
    'رشد ضمنی سود نسبت به سود سال',
    'percent',
    'higher',
    'month',
    ['D_ImpliedNI_M', 'NI_FY'],
    (r) => relChange(g(r, 'D_ImpliedNI_M'), g(r, 'NI_FY')),
    '(D_ImpliedNI_M − NI_FY) / |NI_FY| — بیشتر بهتر',
  ),
  m(
    'D_RevAccel_M',
    'شتاب درآمد ماهانه',
    'percent',
    'higher',
    'month',
    ['Rev_1MGR', 'Rev_3MGR'],
    (r) => sub(g(r, 'Rev_1MGR'), g(r, 'Rev_3MGR')),
    'Rev_1MGR − Rev_3MGR — بیشتر بهتر',
  ),
  m(
    'D_RevConsistency_M',
    'ثبات رشد ماهانه',
    'ratio',
    'higher',
    'month',
    ['Rev_3MGR_Arith', 'Rev_3MGR'],
    (r) => consistency(g(r, 'Rev_3MGR_Arith'), g(r, 'Rev_3MGR')),
    '1 − |Rev_3MGR_Arith − Rev_3MGR| / (|Rev_3MGR_Arith| + |Rev_3MGR| + ε) — بیشتر بهتر',
  ),
];

function consistency(arith: Num, cagr: Num): Num {
  if (!isNum(arith) || !isNum(cagr)) return null;
  return 1 - Math.abs(arith - cagr) / (Math.abs(arith) + Math.abs(cagr) + EPS);
}

// ───────────── ز) technical (normalized for cross-symbol comparison) ─────────────
const pxTo = (n: number): MetricDef =>
  m(
    `D_PxToSMA${n}`,
    `فاصله قیمت از میانگین ${n} روزه`,
    'percent',
    'neutral',
    'technical',
    ['Price', `SMA_${n}D`],
    (r) => sub(safeDiv(g(r, 'Price'), g(r, `SMA_${n}D`)), 1),
    `Price / SMA_${n}D − 1`,
  );

const technical: MetricDef[] = [
  pxTo(20),
  pxTo(50),
  pxTo(200),
  m(
    'D_MAAlignment',
    'هم‌راستایی میانگین‌ها',
    'ratio',
    'higher',
    'technical',
    ['Price', 'SMA_20D', 'SMA_50D', 'SMA_200D', 'EMA_50D', 'EMA_200D', 'sar'],
    (r) =>
      boolMean([
        gt(g(r, 'Price'), g(r, 'SMA_20D')),
        gt(g(r, 'SMA_20D'), g(r, 'SMA_50D')),
        gt(g(r, 'SMA_50D'), g(r, 'SMA_200D')),
        gt(g(r, 'EMA_50D'), g(r, 'EMA_200D')),
        gt(g(r, 'Price'), g(r, 'sar')),
      ]),
    'میانگین شرط‌های Price>SMA20، SMA20>SMA50، SMA50>SMA200، EMA50>EMA200، Price>SAR (۰ تا ۱)',
  ),
  m(
    'D_DirectionalADX',
    'جهت و قدرت روند (ADX جهت‌دار)',
    'number',
    'higher',
    'technical',
    ['plus_di', 'minus_di', 'adx'],
    directionalAdx,
    '((+DI − −DI)/(+DI + −DI)) × min(ADX/25, 1) — بین −۱ و +۱',
  ),
  m(
    'D_RegSlopeNorm',
    'شیب رگرسیون نرمال‌شده',
    'percent',
    'higher',
    'technical',
    ['linearreg_slope', 'Price'],
    (r) => safeDiv(g(r, 'linearreg_slope'), g(r, 'Price')),
    'linearreg_slope / Price',
  ),
  m(
    'D_MACDHistNorm',
    'هیستوگرام MACD نرمال‌شده',
    'percent',
    'higher',
    'technical',
    ['macdHistogram', 'Price'],
    (r) => safeDiv(g(r, 'macdHistogram'), g(r, 'Price')),
    'macdHistogram / Price',
  ),
  m(
    'D_BollingerPctB',
    'موقعیت در باند بولینگر (%B)',
    'ratio',
    'band',
    'technical',
    ['Price', 'blbands', 'bubands'],
    (r) => safeDiv(sub(g(r, 'Price'), g(r, 'blbands')), sub(g(r, 'bubands'), g(r, 'blbands'))),
    '(Price − blbands) / (bubands − blbands)؛ ۰=باند پایین، ۱=باند بالا',
  ),
  m(
    'D_PivotPos',
    'موقعیت بین حمایت و مقاومت',
    'ratio',
    'band',
    'technical',
    ['Price', 'pp_standard_s1', 'pp_standard_r1'],
    (r) =>
      safeDiv(
        sub(g(r, 'Price'), g(r, 'pp_standard_s1')),
        sub(g(r, 'pp_standard_r1'), g(r, 'pp_standard_s1')),
      ),
    '(Price − S1) / (R1 − S1) پیوت استاندارد',
  ),
  m(
    'D_PxToVWAP1M',
    'فاصله قیمت از VWAP ماهانه',
    'percent',
    'higher',
    'technical',
    ['Price', 'AvgVWAP_1M'],
    (r) => sub(safeDiv(g(r, 'Price'), g(r, 'AvgVWAP_1M')), 1),
    'Price / AvgVWAP_1M − 1',
  ),
  m(
    'D_VolSurge_5_90',
    'ورود حجم (۵ به ۹۰ روز)',
    'ratio',
    'band',
    'technical',
    ['AvgVol_5D', 'AvgVol_90D'],
    (r) => safeDiv(g(r, 'AvgVol_5D'), g(r, 'AvgVol_90D')),
    'AvgVol_5D / AvgVol_90D',
  ),
  m(
    'D_VolSurge_20_1Y',
    'ورود حجم (۲۰ روز به یک سال)',
    'ratio',
    'higher',
    'technical',
    ['AvgVol_20D', 'AvgVol_1Yr'],
    (r) => safeDiv(g(r, 'AvgVol_20D'), g(r, 'AvgVol_1Yr')),
    'AvgVol_20D / AvgVol_1Yr',
  ),
  m(
    'D_VolToday_30',
    'حجم امروز به میانگین ۳۰ روزه',
    'ratio',
    'higher',
    'technical',
    ['CurrentVolume', 'AvgVol_30D'],
    (r) => safeDiv(g(r, 'CurrentVolume'), g(r, 'AvgVol_30D')),
    'CurrentVolume / AvgVol_30D',
  ),
  m(
    'D_LogLiquidity',
    'لگاریتم نقدشوندگی',
    'number',
    'higher',
    'technical',
    ['AvgVal_20D'],
    (r) =>
      isNum(g(r, 'AvgVal_20D')) && (g(r, 'AvgVal_20D') as number) > 0
        ? Math.log10(g(r, 'AvgVal_20D') as number)
        : null,
    'log10(AvgVal_20D)',
  ),
  m(
    'D_NetIndToVal',
    'ورود پول حقیقی به نقدشوندگی',
    'percent',
    'higher',
    'technical',
    ['NetIndividualValue', 'AvgVal_20D'],
    (r) => safeDiv(g(r, 'NetIndividualValue'), g(r, 'AvgVal_20D')),
    'NetIndividualValue / AvgVal_20D',
  ),
  m(
    'D_ADOscNorm',
    'نوسان‌گر چایکین نرمال‌شده',
    'ratio',
    'higher',
    'technical',
    ['adosc', 'AvgVol_20D'],
    (r) => safeDiv(g(r, 'adosc'), g(r, 'AvgVol_20D')),
    'adosc / AvgVol_20D',
  ),
  m(
    'D_DownsideRatio',
    'سهم نوسان نزولی',
    'ratio',
    'lower',
    'technical',
    ['SemiStdDev_90D', 'StdDev_90D'],
    (r) => safeDiv(g(r, 'SemiStdDev_90D'), g(r, 'StdDev_90D')),
    'SemiStdDev_90D / StdDev_90D — کمتر بهتر',
  ),
  m(
    'D_BetaDeviation',
    'فاصله بتا از ۱',
    'number',
    'lower',
    'technical',
    ['Beta_60W'],
    (r) => abs(sub(g(r, 'Beta_60W'), 1)),
    '|Beta_60W − 1|',
  ),
];

function directionalAdx(r: RowAccessor): Num {
  const p = g(r, 'plus_di');
  const n = g(r, 'minus_di');
  const adx = g(r, 'adx');
  if (!isNum(p) || !isNum(n) || !isNum(adx) || p + n === 0) return null;
  return ((p - n) / (p + n)) * Math.min(adx / 25, 1);
}

// ───────────── composite metrics used by the fundamental profiles ─────────────
const composite: MetricDef[] = [
  m(
    'D_GrowthConsistency_5y',
    'ثبات رشد ۵ ساله درآمد',
    'ratio',
    'higher',
    'long',
    ['Rev_5yrGR_Arith', 'Rev_5YrGR'],
    (r) => consistency(g(r, 'Rev_5yrGR_Arith'), g(r, 'Rev_5YrGR')),
    '1 − |Rev_5yrGR_Arith − Rev_5YrGR| / (|Rev_5yrGR_Arith| + |Rev_5YrGR| + ε) — بیشتر بهتر',
  ),
  m(
    'D_PiotroskiLite',
    'امتیاز پیوتروسکی ساده‌شده (۰ تا ۷)',
    'number',
    'higher',
    'long',
    [
      'ROA',
      'D_CFO',
      'NI_TTM',
      'TA_MRQ',
      'NI_FY',
      'TA_FY',
      'TL_MRQ',
      'TL_FY',
      'GPMargin',
      'GP_FY',
      'Rev_FY',
      'Rev_TTM',
    ],
    piotroski,
    'تعداد شرط‌های برقرار: ROA>0، CFO>0، CFO>NI، بهبود ROA، کاهش اهرم، بهبود حاشیه ناخالص، بهبود گردش دارایی',
  ),
  m(
    'D_FiscalYearEndMonth',
    'ماه پایان سال مالی',
    'number',
    'neutral',
    'long',
    ['FiscalYear'],
    (r) => (isNum(g(r, 'FiscalYear')) ? Math.floor((g(r, 'FiscalYear') as number) / 100) : null),
    'FiscalYear (MMDD) ← ماه؛ ۱۲ یعنی اسفند',
  ),
];

/** Minimum evaluable Piotroski tests for a score (otherwise null). */
const PIOTROSKI_MIN_TESTS = 4;

function piotroski(r: RowAccessor): Num {
  const tests: Array<boolean | null> = [
    gt(g(r, 'ROA'), 0),
    gt(g(r, 'D_CFO'), 0),
    gt(g(r, 'D_CFO'), g(r, 'NI_TTM')),
    gt(safeDiv(g(r, 'NI_TTM'), g(r, 'TA_MRQ')), safeDiv(g(r, 'NI_FY'), g(r, 'TA_FY'))),
    gt(safeDiv(g(r, 'TL_FY'), g(r, 'TA_FY')), safeDiv(g(r, 'TL_MRQ'), g(r, 'TA_MRQ'))),
    gt(g(r, 'GPMargin'), safeDiv(g(r, 'GP_FY'), g(r, 'Rev_FY'))),
    gt(safeDiv(g(r, 'Rev_TTM'), g(r, 'TA_MRQ')), safeDiv(g(r, 'Rev_FY'), g(r, 'TA_FY'))),
  ];
  const known = tests.filter((t) => t !== null);
  return known.length < PIOTROSKI_MIN_TESTS ? null : known.filter(Boolean).length;
}

export const derivedMetrics: readonly MetricDef[] = [
  ...leverage,
  ...quality,
  ...valuation,
  ...trend,
  ...quarterly,
  ...monthly,
  ...technical,
  ...composite,
];
