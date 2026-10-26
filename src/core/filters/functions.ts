import type { Dataset } from '../types';
import { percentileRanks, mean, median, std } from '../utils/stats';
import { rankDescending } from '../scoring/grades';
import { realGrowth } from '../metrics/helpers';

export type VType = 'num' | 'text' | 'bool';
export type Vec = { t: 'num'; v: Float64Array } | { t: 'text'; v: string[] } | { t: 'bool'; v: Uint8Array };

export interface EvalContext {
  ds: Dataset;
  inflation: number;
  constants: Record<string, number>;
}

export interface FnDef {
  name: string;
  category: 'math' | 'null' | 'finance' | 'cross' | 'text';
  signature: string;
  description: string;
  example: string;
  minArgs: number;
  maxArgs: number;
  /** Expected type per argument position; the last entry repeats for variadic functions. */
  args: Array<VType | 'any'>;
  returns: VType | 'arg';
  impl: (args: Vec[], ctx: EvalContext) => Vec;
}

const n = (ctx: EvalContext) => ctx.ds.size;
const nums = (v: Vec): Float64Array =>
  v.t === 'num' ? v.v : v.t === 'bool' ? Float64Array.from(v.v) : new Float64Array(v.v.length).fill(NaN);
const num = (v: Float64Array): Vec => ({ t: 'num', v });
const bool = (v: Uint8Array): Vec => ({ t: 'bool', v });

function map1(a: Vec, f: (x: number) => number): Vec {
  const x = nums(a);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = Number.isNaN(x[i] as number) ? NaN : f(x[i] as number);
  return num(out);
}

function map2(a: Vec, b: Vec, f: (x: number, y: number) => number): Vec {
  const x = nums(a);
  const y = nums(b);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number;
    const yi = y[i] as number;
    out[i] = Number.isNaN(xi) || Number.isNaN(yi) ? NaN : f(xi, yi);
  }
  return num(out);
}

const finite = (x: number) => (Number.isFinite(x) ? x : NaN);

function reduceIgnoringNull(args: Vec[], pick: (a: number, b: number) => number): Vec {
  const cols = args.map(nums);
  const len = cols[0]?.length ?? 0;
  const out = new Float64Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    for (const c of cols) {
      const v = c[i] as number;
      if (Number.isNaN(v)) continue;
      out[i] = Number.isNaN(out[i] as number) ? v : pick(out[i] as number, v);
    }
  }
  return num(out);
}

function groups(ctx: EvalContext, field: 'Sector' | 'Industry' | null): number[][] {
  const all = Array.from({ length: n(ctx) }, (_, i) => i);
  const keys = field ? ctx.ds.text[field] : undefined;
  if (!keys) return [all];
  const m = new Map<string, number[]>();
  for (const i of all) {
    const k = keys[i] ?? '';
    const list = m.get(k);
    if (list) list.push(i);
    else m.set(k, [i]);
  }
  return [...m.values()];
}

function pctBy(field: 'Sector' | 'Industry' | null) {
  return (args: Vec[], ctx: EvalContext): Vec => {
    const x = nums(args[0] as Vec).map(finite);
    const out = new Float64Array(x.length).fill(NaN);
    for (const idx of groups(ctx, field)) percentileRanks(x, idx, out);
    return num(out);
  };
}

function aggBy(field: 'Sector' | 'Industry', agg: (xs: number[]) => number) {
  return (args: Vec[], ctx: EvalContext): Vec => {
    const x = nums(args[0] as Vec);
    const out = new Float64Array(x.length).fill(NaN);
    for (const idx of groups(ctx, field)) {
      const v = agg(idx.map((i) => x[i] as number).filter(Number.isFinite));
      for (const i of idx) out[i] = v;
    }
    return num(out);
  };
}

const PERIODS_EXAMPLE = 'real(NIQtrlyGR_YoY) > 0';

export const functions: FnDef[] = [
  // ─── math ───
  {
    name: 'abs',
    category: 'math',
    signature: 'abs(x)',
    description: 'قدر مطلق',
    example: 'abs(D_FxShareNI) < 10%',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, Math.abs),
  },
  {
    name: 'min',
    category: 'math',
    signature: 'min(x, y, …)',
    description: 'کمینه (مقادیر خالی نادیده گرفته می‌شوند)',
    example: 'min(PtoE_ttm, D_FwdPE_Q) < 6',
    minArgs: 1,
    maxArgs: 20,
    args: ['num'],
    returns: 'num',
    impl: (a) => reduceIgnoringNull(a, Math.min),
  },
  {
    name: 'max',
    category: 'math',
    signature: 'max(x, y, …)',
    description: 'بیشینه (مقادیر خالی نادیده گرفته می‌شوند)',
    example: 'max(Ret_1M, Ret_3M) > 20%',
    minArgs: 1,
    maxArgs: 20,
    args: ['num'],
    returns: 'num',
    impl: (a) => reduceIgnoringNull(a, Math.max),
  },
  {
    name: 'log',
    category: 'math',
    signature: 'log(x)',
    description: 'لگاریتم مبنای ۱۰',
    example: 'log(MarketCap) > 13',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, (x) => (x > 0 ? Math.log10(x) : NaN)),
  },
  {
    name: 'ln',
    category: 'math',
    signature: 'ln(x)',
    description: 'لگاریتم طبیعی',
    example: 'ln(AvgVal_20D) > 25',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, (x) => (x > 0 ? Math.log(x) : NaN)),
  },
  {
    name: 'sqrt',
    category: 'math',
    signature: 'sqrt(x)',
    description: 'جذر',
    example: 'sqrt(MarketCap)',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, (x) => (x >= 0 ? Math.sqrt(x) : NaN)),
  },
  {
    name: 'pow',
    category: 'math',
    signature: 'pow(x, y)',
    description: 'توان',
    example: 'pow(1 + Rev_3YrGR, 3) > 2',
    minArgs: 2,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'num',
    impl: ([a, b]) => map2(a as Vec, b as Vec, (x, y) => finite(Math.pow(x, y))),
  },
  {
    name: 'round',
    category: 'math',
    signature: 'round(x, n=0)',
    description: 'گرد کردن تا n رقم اعشار',
    example: 'round(RSI) = 50',
    minArgs: 1,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'num',
    impl: ([a, b], ctx) =>
      map2(a as Vec, b ?? num(new Float64Array(n(ctx))), (x, d) => Math.round(x * 10 ** d) / 10 ** d),
  },
  {
    name: 'floor',
    category: 'math',
    signature: 'floor(x)',
    description: 'جزء صحیح رو به پایین',
    example: 'floor(D_FiscalYearEndMonth) = 12',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, Math.floor),
  },
  {
    name: 'ceil',
    category: 'math',
    signature: 'ceil(x)',
    description: 'جزء صحیح رو به بالا',
    example: 'ceil(D_PiotroskiLite) >= 5',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, Math.ceil),
  },
  {
    name: 'clamp',
    category: 'math',
    signature: 'clamp(x, lo, hi)',
    description: 'محدود کردن x به بازه [lo, hi]',
    example: 'clamp(PtoE_ttm, 0, 30) < 8',
    minArgs: 3,
    maxArgs: 3,
    args: ['num', 'num', 'num'],
    returns: 'num',
    impl: ([a, lo, hi]) => map2(map2(a as Vec, lo as Vec, Math.max), hi as Vec, Math.min),
  },
  {
    name: 'sign',
    category: 'math',
    signature: 'sign(x)',
    description: 'علامت (−۱، ۰، +۱)',
    example: 'sign(NI_MRQ) > 0',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => map1(a as Vec, Math.sign),
  },

  // ─── null & logic ───
  {
    name: 'coalesce',
    category: 'null',
    signature: 'coalesce(x, y, …)',
    description: 'نخستین مقدار غیرخالی',
    example: 'coalesce(EBIT, OP_TTM) > 0',
    minArgs: 1,
    maxArgs: 20,
    args: ['num'],
    returns: 'num',
    impl: (args) => coalesce(args),
  },
  {
    name: 'ifnull',
    category: 'null',
    signature: 'ifnull(x, y)',
    description: 'اگر x خالی بود y',
    example: 'ifnull(DivYield, 0) > 5%',
    minArgs: 2,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'num',
    impl: (args) => coalesce(args),
  },
  {
    name: 'isnull',
    category: 'null',
    signature: 'isnull(x)',
    description: 'آیا x خالی است؟',
    example: 'isnull(Rev_1M)',
    minArgs: 1,
    maxArgs: 1,
    args: ['any'],
    returns: 'bool',
    impl: ([a]) => {
      const v = a as Vec;
      if (v.t === 'num') return bool(Uint8Array.from(v.v, (x) => (Number.isNaN(x) ? 1 : 0)));
      if (v.t === 'text') return bool(Uint8Array.from(v.v, (x) => (x === '' ? 1 : 0)));
      return bool(new Uint8Array(v.v.length));
    },
  },
  {
    name: 'if',
    category: 'null',
    signature: 'if(شرط, a, b)',
    description: 'اگر شرط برقرار بود a وگرنه b',
    example: 'if(NI_TTM > 0, PtoE_ttm, 99) < 8',
    minArgs: 3,
    maxArgs: 3,
    args: ['bool', 'any', 'any'],
    returns: 'arg',
    impl: ([c, a, b]) => {
      const cond = (c as Extract<Vec, { t: 'bool' }>).v;
      if ((a as Vec).t === 'text') {
        const x = (a as Extract<Vec, { t: 'text' }>).v;
        const y = (b as Extract<Vec, { t: 'text' }>).v;
        return { t: 'text', v: x.map((s, i) => (cond[i] ? s : (y[i] ?? ''))) };
      }
      const x = nums(a as Vec);
      const y = nums(b as Vec);
      return num(Float64Array.from(x, (v, i) => (cond[i] ? v : (y[i] as number))));
    },
  },
  {
    name: 'safe_div',
    category: 'null',
    signature: 'safe_div(a, b)',
    description: 'تقسیم امن (مخرج صفر ← خالی)',
    example: 'safe_div(NI_MRQ, NI_FY) > 35%',
    minArgs: 2,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'num',
    impl: ([a, b]) => map2(a as Vec, b as Vec, (x, y) => (y === 0 ? NaN : x / y)),
  },

  // ─── finance ───
  {
    name: 'real',
    category: 'finance',
    signature: 'real(g, دوره_در_سال=1)',
    description: 'تعدیل تورم: (1+g)/(1+π_دوره) − 1؛ برای فصلی ۴ و ماهانه ۱۲',
    example: PERIODS_EXAMPLE,
    minArgs: 1,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'num',
    impl: ([g, p], ctx) =>
      map2(
        g as Vec,
        p ?? num(new Float64Array(n(ctx)).fill(1)),
        (x, k) => realGrowth(x, ctx.inflation, k) ?? NaN,
      ),
  },
  {
    name: 'annualize',
    category: 'finance',
    signature: 'annualize(x, دوره)',
    description: 'سالانه‌سازی رشد دوره‌ای: (1+x)^دوره − 1',
    example: 'annualize(RevQtrlyGR_QoQ, 4) > 50%',
    minArgs: 2,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'num',
    impl: ([a, b]) => map2(a as Vec, b as Vec, (x, k) => finite(Math.pow(1 + x, k) - 1)),
  },
  {
    name: 'cagr',
    category: 'finance',
    signature: 'cagr(پایان, آغاز, سال)',
    description: 'نرخ رشد مرکب سالانه',
    example: 'cagr(Rev_TTM, Rev_FY, 1) > 0',
    minArgs: 3,
    maxArgs: 3,
    args: ['num', 'num', 'num'],
    returns: 'num',
    impl: ([e, s, y]) =>
      map2(
        map2(e as Vec, s as Vec, (a, b) => (b > 0 && a > 0 ? a / b : NaN)),
        y as Vec,
        (r, t) => (t > 0 ? Math.pow(r, 1 / t) - 1 : NaN),
      ),
  },

  // ─── cross-sectional ───
  {
    name: 'pct_rank',
    category: 'cross',
    signature: 'pct_rank(x)',
    description: 'صدک در کل بازار (۰ تا ۱۰۰)',
    example: 'pct_rank(ROE) > 80',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: pctBy(null),
  },
  {
    name: 'sector_pct',
    category: 'cross',
    signature: 'sector_pct(x)',
    description: 'صدک در بخش (۰ تا ۱۰۰)',
    example: 'sector_pct(ROE) > 80',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: pctBy('Sector'),
  },
  {
    name: 'industry_pct',
    category: 'cross',
    signature: 'industry_pct(x)',
    description: 'صدک در صنعت (۰ تا ۱۰۰)',
    example: 'industry_pct(D_PE_ttm) < 20',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: pctBy('Industry'),
  },
  {
    name: 'zscore',
    category: 'cross',
    signature: 'zscore(x)',
    description: 'انحراف از میانگین بازار بر حسب انحراف معیار',
    example: 'zscore(Ret_1M) > 2',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a]) => {
      const x = nums(a as Vec);
      const vals = [...x].filter(Number.isFinite);
      const m = mean(vals);
      const s = std(vals);
      return map1(a as Vec, (v) => (Number.isFinite(v) && s > 0 ? (v - m) / s : NaN));
    },
  },
  {
    name: 'sector_avg',
    category: 'cross',
    signature: 'sector_avg(x)',
    description: 'میانگین x در بخش نماد',
    example: 'ROE > sector_avg(ROE)',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: aggBy('Sector', mean),
  },
  {
    name: 'sector_median',
    category: 'cross',
    signature: 'sector_median(x)',
    description: 'میانه x در بخش نماد',
    example: 'D_PE_ttm < sector_median(D_PE_ttm)',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: aggBy('Sector', median),
  },
  {
    name: 'industry_median',
    category: 'cross',
    signature: 'industry_median(x)',
    description: 'میانه x در صنعت نماد',
    example: 'PtoB < industry_median(PtoB)',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: aggBy('Industry', median),
  },
  {
    name: 'rank',
    category: 'cross',
    signature: 'rank(x)',
    description: 'رتبه نزولی در بازار (۱ = بیشترین)',
    example: 'rank(MarketCap) <= 50',
    minArgs: 1,
    maxArgs: 1,
    args: ['num'],
    returns: 'num',
    impl: ([a], ctx) => {
      const out = new Float64Array(n(ctx)).fill(NaN);
      rankDescending(
        nums(a as Vec).map(finite),
        Array.from({ length: n(ctx) }, (_, i) => i),
        out,
      );
      return num(out);
    },
  },
  {
    name: 'top_n',
    category: 'cross',
    signature: 'top_n(x, n)',
    description: 'آیا جزو n نماد برتر بر اساس x است؟',
    example: 'top_n(score.composite, 20)',
    minArgs: 2,
    maxArgs: 2,
    args: ['num', 'num'],
    returns: 'bool',
    impl: ([a, k], ctx) => {
      const out = new Float64Array(n(ctx)).fill(NaN);
      rankDescending(
        nums(a as Vec).map(finite),
        Array.from({ length: n(ctx) }, (_, i) => i),
        out,
      );
      const limit = nums(k as Vec)[0] ?? 0;
      return bool(Uint8Array.from(out, (r) => (r <= limit ? 1 : 0)));
    },
  },

  // ─── text ───
  {
    name: 'contains',
    category: 'text',
    signature: 'contains(متن, زیررشته)',
    description: 'آیا متن شامل زیررشته است؟',
    example: 'contains(Company, "پتروشیمی")',
    minArgs: 2,
    maxArgs: 2,
    args: ['text', 'text'],
    returns: 'bool',
    impl: ([s, sub]) => textTest(s as Vec, sub as Vec, (a, b) => a.includes(b)),
  },
  {
    name: 'starts_with',
    category: 'text',
    signature: 'starts_with(متن, پیشوند)',
    description: 'آیا متن با پیشوند شروع می‌شود؟',
    example: 'starts_with(Symbol, "و")',
    minArgs: 2,
    maxArgs: 2,
    args: ['text', 'text'],
    returns: 'bool',
    impl: ([s, p]) => textTest(s as Vec, p as Vec, (a, b) => a.startsWith(b)),
  },
];

function coalesce(args: Vec[]): Vec {
  const cols = args.map(nums);
  const len = cols[0]?.length ?? 0;
  const out = new Float64Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    for (const c of cols) {
      if (!Number.isNaN(c[i] as number)) {
        out[i] = c[i] as number;
        break;
      }
    }
  }
  return num(out);
}

export function textTest(s: Vec, sub: Vec, f: (a: string, b: string) => boolean): Vec {
  const a = s.t === 'text' ? s.v : [];
  const b = sub.t === 'text' ? sub.v : [];
  return bool(Uint8Array.from(a, (x, i) => (x !== '' && f(x, b[i] ?? '') ? 1 : 0)));
}

export const functionByName: ReadonlyMap<string, FnDef> = new Map(functions.map((f) => [f.name, f]));
export { nums };
