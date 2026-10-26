import type { Node } from './ast';
import { functionByName, nums, textTest, type EvalContext, type Vec } from './functions';

/** Vectorized evaluation over the whole dataset (PLAN.md §11.4). Null semantics follow SQL (§11.3). */
export function evaluate(node: Node, ctx: EvalContext): Vec {
  const size = ctx.ds.size;
  switch (node.type) {
    case 'num':
      return { t: 'num', v: new Float64Array(size).fill(node.value) };
    case 'str':
      return { t: 'text', v: new Array<string>(size).fill(node.value) };
    case 'bool':
      return { t: 'bool', v: new Uint8Array(size).fill(node.value ? 1 : 0) };
    case 'null':
      return { t: 'num', v: new Float64Array(size).fill(NaN) };
    case 'field':
      return field(node.name, ctx);
    case 'call': {
      const fn = functionByName.get(node.name);
      if (!fn) throw new Error(`unknown function ${node.name}`);
      const args = node.args.map((a, k) =>
        coerce(evaluate(a, ctx), fn.args[Math.min(k, fn.args.length - 1)] ?? 'any'),
      );
      return fn.impl(args, ctx);
    }
    case 'neg':
      return { t: 'num', v: nums(evaluate(node.arg, ctx)).map((x) => -x) };
    case 'not':
      return { t: 'bool', v: truthy(evaluate(node.arg, ctx)).map((x) => 1 - x) };
    case 'arith':
      return arith(node.op, nums(evaluate(node.left, ctx)), nums(evaluate(node.right, ctx)));
    case 'logic': {
      const a = truthy(evaluate(node.left, ctx));
      const b = truthy(evaluate(node.right, ctx));
      return {
        t: 'bool',
        v: a.map((x, i) => (node.op === 'AND' ? x & (b[i] as number) : x | (b[i] as number))),
      };
    }
    case 'compare':
      return compare(node.op, evaluate(node.left, ctx), evaluate(node.right, ctx));
    case 'in':
      return inList(
        evaluate(node.arg, ctx),
        node.list.map((n) => evaluate(n, ctx)),
        node.negated,
      );
    case 'between': {
      const x = nums(evaluate(node.arg, ctx));
      const lo = nums(evaluate(node.low, ctx));
      const hi = nums(evaluate(node.high, ctx));
      return {
        t: 'bool',
        v: Uint8Array.from(x, (v, i) => {
          if (Number.isNaN(v) || Number.isNaN(lo[i] as number) || Number.isNaN(hi[i] as number)) return 0;
          const inside = v >= (lo[i] as number) && v <= (hi[i] as number);
          return inside !== node.negated ? 1 : 0;
        }),
      };
    }
    case 'contains':
      return textTest(evaluate(node.arg, ctx), evaluate(node.sub, ctx), (a, b) => a.includes(b));
    case 'isnull': {
      const v = evaluate(node.arg, ctx);
      const isNull =
        v.t === 'num'
          ? Uint8Array.from(v.v, (x) => (Number.isNaN(x) ? 1 : 0))
          : v.t === 'text'
            ? Uint8Array.from(v.v, (x) => (x === '' ? 1 : 0))
            : new Uint8Array(v.v.length);
      return { t: 'bool', v: node.negated ? isNull.map((x) => 1 - x) : isNull };
    }
  }
}

function field(name: string, ctx: EvalContext): Vec {
  const constant = ctx.constants[name];
  if (constant !== undefined) return { t: 'num', v: new Float64Array(ctx.ds.size).fill(constant) };
  const num = ctx.ds.num[name];
  // NEGATIVE_BASE (−∞) and other non-finite values behave as null in the filter language.
  if (num) return { t: 'num', v: num.map((x) => (Number.isFinite(x) ? x : NaN)) };
  const text = ctx.ds.text[name];
  if (text) return { t: 'text', v: text };
  return { t: 'num', v: new Float64Array(ctx.ds.size).fill(NaN) };
}

/** Boolean view: true = finite non-zero number / true / non-empty text never counts (text is not truthy). */
export function truthy(v: Vec): Uint8Array {
  if (v.t === 'bool') return v.v;
  if (v.t === 'num') return Uint8Array.from(v.v, (x) => (Number.isFinite(x) && x !== 0 ? 1 : 0));
  return new Uint8Array(v.v.length);
}

function coerce(v: Vec, want: string): Vec {
  if (want === 'bool' && v.t !== 'bool') return { t: 'bool', v: truthy(v) };
  if (want === 'num' && v.t === 'bool') return { t: 'num', v: Float64Array.from(v.v) };
  return v;
}

function arith(op: string, a: Float64Array, b: Float64Array): Vec {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number;
    const y = b[i] as number;
    let r: number;
    if (op === '+') r = x + y;
    else if (op === '-') r = x - y;
    else if (op === '*') r = x * y;
    else if (op === '/') r = y === 0 ? NaN : x / y;
    else if (op === '%') r = y === 0 ? NaN : x % y;
    else r = Math.pow(x, y);
    out[i] = Number.isFinite(r) ? r : NaN;
  }
  return { t: 'num', v: out };
}

function compare(op: string, a: Vec, b: Vec): Vec {
  const len = a.v.length;
  const out = new Uint8Array(len);
  if (a.t === 'text' && b.t === 'text') {
    for (let i = 0; i < len; i++) {
      const x = a.v[i] as string;
      const y = b.v[i] as string;
      if (x === '' || y === '') continue;
      const d = op === '=' || op === '!=' ? (x === y ? 0 : 1) : x.localeCompare(y, 'fa');
      out[i] = cmp(op, d) ? 1 : 0;
    }
    return { t: 'bool', v: out };
  }
  const x = nums(a);
  const y = nums(b);
  for (let i = 0; i < len; i++) {
    const xi = x[i] as number;
    const yi = y[i] as number;
    if (Number.isNaN(xi) || Number.isNaN(yi)) continue;
    out[i] = cmp(op, xi - yi) ? 1 : 0;
  }
  return { t: 'bool', v: out };
}

function cmp(op: string, d: number): boolean {
  switch (op) {
    case '>':
      return d > 0;
    case '>=':
      return d >= 0;
    case '<':
      return d < 0;
    case '<=':
      return d <= 0;
    case '=':
      return d === 0;
    default:
      return d !== 0;
  }
}

function inList(arg: Vec, items: Vec[], negated: boolean): Vec {
  const len = arg.v.length;
  const out = new Uint8Array(len);
  if (arg.t === 'text') {
    const set = new Set(items.map((it) => (it.t === 'text' ? it.v[0] : '')));
    for (let i = 0; i < len; i++) {
      const x = arg.v[i] as string;
      if (x !== '') out[i] = set.has(x) !== negated ? 1 : 0;
    }
    return { t: 'bool', v: out };
  }
  const x = nums(arg);
  const set = new Set(items.map((it) => nums(it)[0]));
  for (let i = 0; i < len; i++) {
    const v = x[i] as number;
    if (!Number.isNaN(v)) out[i] = set.has(v) !== negated ? 1 : 0;
  }
  return { t: 'bool', v: out };
}
