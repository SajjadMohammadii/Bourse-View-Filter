import type { FlagDef } from '../core/scoring/types';
import { gt, isNum } from '../core/metrics/helpers';
import type { Num } from '../core/metrics/helpers';

/** Rule flags (PLAN.md §7.2, §9, §10). Each returns true / false / null (unknown). */

const all = (...xs: Array<boolean | null>): boolean | null =>
  xs.some((x) => x === false) ? false : xs.includes(null) ? null : true;
const lt = (a: Num, b: Num): boolean | null => gt(b, a);
const ge = (a: Num, b: Num): boolean | null => (isNum(a) && isNum(b) ? a >= b : null);

export const technicalFlags: FlagDef[] = [
  {
    id: 'goldenCross',
    label: 'کراس طلایی (نزدیک)',
    description: 'SMA50 > SMA200 و فاصله قیمت از SMA50 کمتر از ۵٪',
    tone: 'good',
    requires: ['SMA_50D', 'SMA_200D', 'D_PxToSMA50'],
    test: (r) => all(gt(r.get('SMA_50D'), r.get('SMA_200D')), lt(r.get('D_PxToSMA50'), 0.05)),
  },
  {
    id: 'breakout200',
    label: 'شکست سقف ۲۰۰ روزه با حجم',
    description: 'High_200D ≥ ۰٫۹۸ و ورود حجم ۵ به ۹۰ روزه ≥ ۱٫۵',
    tone: 'good',
    requires: ['High_200D', 'D_VolSurge_5_90'],
    test: (r) => all(ge(r.get('High_200D'), 0.98), ge(r.get('D_VolSurge_5_90'), 1.5)),
  },
  {
    id: 'oversold',
    label: 'اشباع فروش',
    description: 'RSI < ۳۰ و ویلیامز %R < −۸۰',
    tone: 'neutral',
    requires: ['RSI', 'willr'],
    test: (r) => all(lt(r.get('RSI'), 30), lt(r.get('willr'), -80)),
  },
  {
    id: 'smartMoneyIn',
    label: 'ورود پول هوشمند',
    description: 'خالص ورود حقیقی مثبت و قدرت خریدار حقیقی ≥ ۱٫۵',
    tone: 'good',
    requires: ['NetIndividual', 'IndividualBuyPower'],
    test: (r) => all(gt(r.get('NetIndividual'), 0), ge(r.get('IndividualBuyPower'), 1.5)),
  },
  {
    id: 'illiquid',
    label: 'کم‌نقدشونده',
    description: 'میانگین ارزش معاملات ۲۰ روزه کمتر از آستانه تنظیمات',
    tone: 'bad',
    requires: ['AvgVal_20D'],
    test: (r, ctx) => lt(r.get('AvgVal_20D'), ctx.thresholds.illiquidAvgValue),
  },
];

export const flagHelpers = { all, lt, ge };

const { all: allOf } = flagHelpers;
const anyOf = (...xs: Array<boolean | null>): boolean | null =>
  xs.some((x) => x === true) ? true : xs.includes(null) ? null : false;

export const quarterlyFlags: FlagDef[] = [
  {
    id: 'turnaroundQ',
    label: 'تحول فصلی (بازگشت به سود)',
    description: 'سود فصل مثبت و (سود سال مالی منفی یا سود فصل قبل منفی یا رشد فصلی خالی به‌دلیل پایه منفی)',
    tone: 'good',
    requires: ['NI_MRQ', 'NI_FY', 'D_NI_PrevQ_est', 'NIQtrlyGR_QoQ', 'NI_TTM'],
    test: (r) =>
      allOf(
        gt(r.get('NI_MRQ'), 0),
        anyOf(
          lt(r.get('NI_FY'), 0),
          lt(r.get('D_NI_PrevQ_est'), 0),
          r.get('NIQtrlyGR_QoQ') === null && isNum(r.get('NI_TTM')) && isNum(r.get('NI_MRQ'))
            ? (r.get('NI_TTM') as number) - (r.get('NI_MRQ') as number) < 0
            : false,
        ),
      ),
  },
  {
    id: 'marginBreakout',
    label: 'جهش حاشیه سود',
    description: 'بهبود حاشیه خالص فصل > ۵ واحد درصد و رشد سالانه سود فصل بیشتر از تورم',
    tone: 'good',
    requires: ['D_dNPMargin_Q', 'NIQtrlyGR_YoY'],
    test: (r, ctx) =>
      allOf(gt(r.get('D_dNPMargin_Q'), 0.05), gt(r.get('NIQtrlyGR_YoY'), ctx.assumptions.inflation)),
  },
  {
    id: 'earningsSurprise',
    label: 'سورپرایز سود',
    description: 'سود فصل سالانه‌شده بیش از ۱٫۵ برابر سود ۱۲ ماهه',
    tone: 'good',
    requires: ['D_NI_RunRate'],
    test: (r) => gt(r.get('D_NI_RunRate'), 1.5),
  },
  {
    id: 'staleStatement',
    label: 'صورت مالی کهنه',
    description: 'عمر آخرین صورت مالی بیش از آستانه تنظیمات (پیش‌فرض ۲۰۰ روز)',
    tone: 'bad',
    requires: ['D_StatementAgeDays'],
    test: (r, ctx) => gt(r.get('D_StatementAgeDays'), ctx.thresholds.staleStatementDays),
  },
  {
    id: 'oneOffRisk',
    label: 'ریسک سود غیرتکراری',
    description: 'بیش از نیمی از سود فصل غیرعملیاتی است',
    tone: 'bad',
    requires: ['D_NonOpShare_Q'],
    test: (r) => gt(r.get('D_NonOpShare_Q'), 0.5),
  },
];

export const monthlyFlags: FlagDef[] = [
  {
    id: 'recordMonth',
    label: 'رکورد درآمد ماهانه',
    description: 'درآمد ماه > ۱٫۳ برابر میانگین واقعی ۱۲ ماه و > ۱٫۱۵ برابر میانگین فصل آخر',
    tone: 'good',
    requires: ['D_Rev1M_toAvg12_real', 'D_Rev1M_toQAvg'],
    test: (r) => allOf(gt(r.get('D_Rev1M_toAvg12_real'), 1.3), gt(r.get('D_Rev1M_toQAvg'), 1.15)),
  },
  {
    id: 'monthlyTurn',
    label: 'برگشت روند درآمد',
    description: 'رشد ماه به ماه > ۲۵٪ در حالی که رشد ۳ ماهه منفی است',
    tone: 'good',
    requires: ['Rev_1MGR', 'Rev_3MGR'],
    test: (r) => allOf(gt(r.get('Rev_1MGR'), 0.25), lt(r.get('Rev_3MGR'), 0)),
  },
  {
    id: 'cheapOnMonthly',
    label: 'ارزان بر پایه درآمد ماهانه',
    description: 'P/E ضمنی ماهانه کمتر از ۵ با سود ضمنی مثبت',
    tone: 'good',
    requires: ['D_ImpliedPE_M', 'D_ImpliedNI_M'],
    test: (r) => allOf(lt(r.get('D_ImpliedPE_M'), 5), gt(r.get('D_ImpliedNI_M'), 0)),
  },
];
