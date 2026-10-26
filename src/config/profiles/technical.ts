import type { ProfileDef } from '../../core/scoring/types';
import { band, down, linear, up } from './builders';

/** Technical profile — 7 factors (PLAN.md §7.1). Ranked against the whole market. */
export const technicalProfile: ProfileDef = {
  id: 'technical',
  label: 'تکنیکال',
  description: 'روند، مومنتوم، حجم، جریان پول هوشمند، ریسک و موقعیت قیمت',
  defaultPeerScope: 'market',
  minCoverage: 0.6,
  factors: [
    {
      id: 'T1',
      label: 'روند',
      weight: 22,
      description: 'هم‌راستایی میانگین‌ها، ADX جهت‌دار، آرون، شیب رگرسیون و فاصله از میانگین‌ها',
      metrics: [
        linear('D_MAAlignment', 0, 1),
        linear('D_DirectionalADX', -1, 1),
        linear('aroonosc', -100, 100),
        up('D_RegSlopeNorm'),
        band('D_PxToSMA200', [0, 0.35], [-0.3, 0.8]),
        up('D_PxToSMA50'),
      ],
    },
    {
      id: 'T2',
      label: 'مومنتوم',
      weight: 18,
      description: 'RSI، MACD، PPO، قدرت نسبی بازده ۱، ۳ و ۶ ماهه و نوسان‌گرها',
      metrics: [
        band('RSI', [50, 68], [25, 85]),
        up('D_MACDHistNorm'),
        up('ppo'),
        up('Ret_1M'),
        up('Ret_3M'),
        up('Ret_6M'),
        band('cci', [0, 150], [-150, 300]),
        band('stochastic_slowk', [40, 80], [10, 98]),
        band('ultosc', [50, 70], [25, 90]),
        up('trix'),
      ],
    },
    {
      id: 'T3',
      label: 'حجم و نقدشوندگی',
      weight: 12,
      description: 'ورود حجم، حجم امروز، ارزش معاملات، گردش و شاخص آمیهود',
      metrics: [
        band('D_VolSurge_5_90', [1.1, 2.5], [0.5, 5]),
        up('D_VolSurge_20_1Y'),
        up('D_VolToday_30'),
        up('D_LogLiquidity'),
        up('Turnover'),
        down('Amihud_30d'),
      ],
    },
    {
      id: 'T4',
      label: 'جریان پول هوشمند',
      weight: 16,
      description: 'قدرت خریدار حقیقی، ورود پول حقیقی، فشار تقاضا، MFI و چایکین',
      metrics: [
        up('IndividualBuyPower'),
        up('NetIndividual'),
        up('D_NetIndToVal'),
        up('BidPressure'),
        band('MFI', [50, 80], [20, 95]),
        up('D_ADOscNorm'),
      ],
    },
    {
      id: 'T5',
      label: 'نوسان و ریسک کل',
      weight: 12,
      description: 'امتیاز بالا یعنی ریسک کمتر: انحراف معیار، نیم‌انحراف، ATR نرمال، دامنه نوسان',
      metrics: [
        down('StdDev_90D'),
        down('SemiStdDev_90D'),
        down('natr'),
        down('RelativeRange_1M'),
        down('D_DownsideRatio'),
        down('StdDev_60W'),
      ],
    },
    {
      id: 'T6',
      label: 'موقعیت قیمت و ساختار',
      weight: 10,
      description: 'نزدیکی به سقف‌ها، موقعیت در باند بولینگر و پیوت، فاصله از VWAP ماهانه',
      metrics: [
        up('High_200D'),
        up('High_50D'),
        band('D_BollingerPctB', [0.5, 0.9], [-0.2, 1.3]),
        band('D_PivotPos', [0.3, 0.8], [-0.5, 1.5]),
        up('D_PxToVWAP1M'),
      ],
    },
    {
      id: 'T7',
      label: 'ریسک سیستماتیک',
      weight: 10,
      description: 'بتا و همبستگی کمتر یعنی امتیاز بیشتر (تنوع‌بخشی)',
      metrics: [down('Beta_60W'), down('Beta_90D'), down('Correlation_60W'), down('Beta_36M')],
    },
  ],
  weightPresets: {
    balanced: { label: 'متعادل', weights: { T1: 22, T2: 18, T3: 12, T4: 16, T5: 12, T6: 10, T7: 10 } },
    aggressive: {
      label: 'تهاجمی / مومنتوم',
      weights: { T1: 26, T2: 24, T3: 10, T4: 20, T5: 7, T6: 9, T7: 4 },
    },
    conservative: { label: 'محافظه‌کار', weights: { T1: 16, T2: 12, T3: 16, T4: 12, T5: 20, T6: 8, T7: 16 } },
  },
  derivedScores: [
    {
      id: 'safety',
      label: 'ایمنی نماد (کم‌ریسکی)',
      description: 'T5 (۵۰٪) + T7 (۳۰٪) + نقدشوندگی بر پایه آمیهود (۲۰٪)؛ بالا = ریسک کمتر',
      parts: [
        { factor: 'T5', weight: 0.5 },
        { factor: 'T7', weight: 0.3 },
        { metric: down('Amihud_30d'), weight: 0.2 },
      ],
    },
  ],
};
