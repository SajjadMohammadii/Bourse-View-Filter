import type { MarketRiskConfig, MarketView } from '../core/market/types';

const gt = (v: MarketView, a: string, b: string) => (i: number) => {
  const x = v.num(a, i);
  const y = v.num(b, i);
  return Number.isFinite(x) && Number.isFinite(y) ? x > y : null;
};
const above = (v: MarketView, a: string, t: number) => (i: number) => {
  const x = v.num(a, i);
  return Number.isFinite(x) ? x > t : null;
};
const below = (v: MarketView, a: string, t: number) => (i: number) => {
  const x = v.num(a, i);
  return Number.isFinite(x) ? x < t : null;
};
const avg = (xs: Array<number | null>): number | null => {
  const ok = xs.filter((x): x is number => x !== null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
};

/**
 * Market risk thermometer (PLAN.md §7.3). Scales are absolute thresholds used until
 * enough history exists (minHistory); weights sum to 1.
 */
export const marketRiskConfig: MarketRiskConfig = {
  minHistory: 20,
  regimes: [
    { max: 30, id: 'low', label: 'کم‌ریسک' },
    { max: 55, id: 'balanced', label: 'متعادل' },
    { max: 75, id: 'high', label: 'پرریسک' },
    { max: Infinity, id: 'critical', label: 'بحرانی' },
  ],
  components: [
    {
      id: 'safety',
      label: 'میانگین ایمنی نمادها',
      unit: 'score',
      weight: 0.13,
      scale: [70, 30],
      description: 'میانگین وزنی score.safety (بالا = ریسک کمتر)',
      compute: (v) => v.wmean('score.safety'),
    },
    {
      id: 'breadth',
      label: 'پهنای بازار (بالای میانگین‌ها)',
      unit: 'percent',
      weight: 0.15,
      scale: [0.7, 0.2],
      description: 'میانگین سهم نمادهای بالای SMA50 و SMA200',
      compute: (v) => avg([v.share(gt(v, 'Price', 'SMA_50D')), v.share(gt(v, 'Price', 'SMA_200D'))]),
    },
    {
      id: 'advDecl',
      label: 'نسبت مثبت‌ها به کل',
      unit: 'percent',
      weight: 0.1,
      scale: [0.65, 0.25],
      description: 'سهم نمادهای با تغییر روزانه مثبت از نمادهای مثبت و منفی',
      compute: (v) =>
        v.share((i) => {
          const x = v.num('DailyChange', i);
          return Number.isFinite(x) && x !== 0 ? x > 0 : null;
        }),
    },
    {
      id: 'overbought',
      label: 'اشباع خرید',
      unit: 'percent',
      weight: 0.07,
      scale: [0.05, 0.3],
      description: 'سهم نمادهای با RSI > ۷۰',
      compute: (v) => v.share(above(v, 'RSI', 70)),
    },
    {
      id: 'oversold',
      label: 'اشباع فروش',
      unit: 'percent',
      weight: 0.07,
      scale: [0.05, 0.4],
      description: 'سهم نمادهای با RSI < ۳۰',
      compute: (v) => v.share(below(v, 'RSI', 30)),
    },
    {
      id: 'individualFlow',
      label: 'جریان پول حقیقی',
      unit: 'percent',
      weight: 0.12,
      scale: [0.05, -0.05],
      description: 'میانگین وزنی خالص ورود حقیقی به ارزش معاملات (منفی = خروج پول)',
      compute: (v) => v.wmean('NetIndividual'),
    },
    {
      id: 'volatility',
      label: 'نوسان بازار',
      unit: 'percent',
      weight: 0.06,
      scale: [0.015, 0.045],
      description: 'میانگین وزنی انحراف معیار ۹۰ روزه',
      compute: (v) => v.wmean('StdDev_90D'),
    },
    {
      id: 'natr',
      label: 'ATR نرمال‌شده',
      unit: 'number',
      weight: 0.04,
      scale: [2, 6],
      description: 'میانگین وزنی natr (٪)',
      compute: (v) => v.wmean('natr'),
    },
    {
      id: 'correlation',
      label: 'همبستگی با شاخص',
      unit: 'number',
      weight: 0.06,
      scale: [0.2, 0.7],
      description: 'میانگین وزنی Correlation_60W (بالا = ریسک سیستمی)',
      compute: (v) => v.wmean('Correlation_60W'),
    },
    {
      id: 'beta',
      label: 'بتای بازار',
      unit: 'number',
      weight: 0.04,
      scale: [0.6, 1.3],
      description: 'میانگین وزنی Beta_60W',
      compute: (v) => v.wmean('Beta_60W'),
    },
    {
      id: 'returns',
      label: 'بازده اخیر',
      unit: 'percent',
      weight: 0.08,
      scale: [0.08, -0.08],
      description: 'میانگین بازده وزنی ۱ هفته، ۱ ماه و ۳ ماه',
      compute: (v) => avg([v.wmean('Ret_1W'), v.wmean('Ret_1M'), v.wmean('Ret_3M')]),
    },
    {
      id: 'nearHigh',
      label: 'نزدیکی به سقف (هیجان)',
      unit: 'percent',
      weight: 0.04,
      scale: [0.1, 0.45],
      description: 'سهم نمادهای با High_200D > ۰٫۹۵',
      compute: (v) => v.share(above(v, 'High_200D', 0.95)),
    },
    {
      id: 'dispersion',
      label: 'پراکندگی بازده',
      unit: 'percent',
      weight: 0.04,
      scale: [0.06, 0.2],
      description: 'انحراف معیار مقطعی بازده یک ماهه',
      compute: (v) => v.crossStd('Ret_1M'),
    },
  ],
};
