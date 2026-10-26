import type { Node } from './ast';
import { FilterError, suggest } from './errors';
import { functionByName, type VType } from './functions';

/** Names the analyzer can resolve: dataset fields and named constants. */
export interface FieldCatalog {
  fields: ReadonlyMap<string, VType>;
  constants: ReadonlyMap<string, number>;
}

export interface Analysis {
  /** AST with field names rewritten to their canonical spelling. */
  ast: Node;
  type: VType;
  fields: Set<string>;
}

const TYPE_FA: Record<VType | 'any', string> = {
  num: 'عددی',
  text: 'متنی',
  bool: 'منطقی (درست/نادرست)',
  any: 'هر نوع',
};

/** Resolves names, checks types and reports Persian errors with positions (PLAN.md §11.8). */
export function analyze(ast: Node, catalog: FieldCatalog): Analysis {
  const fields = new Set<string>();
  const lower = new Map<string, string[]>();
  for (const name of catalog.fields.keys()) {
    const k = name.toLowerCase();
    lower.set(k, [...(lower.get(k) ?? []), name]);
  }

  const resolve = (name: string, node: Node): string => {
    if (catalog.fields.has(name) || catalog.constants.has(name)) return name;
    const ci = lower.get(name.toLowerCase());
    if (ci && ci.length === 1) return ci[0] as string;
    const hint = suggest(name, [...catalog.fields.keys(), ...catalog.constants.keys()]);
    throw new FilterError(
      hint ? `ستون «${name}» پیدا نشد. منظورتان «${hint}» است؟` : `ستون «${name}» پیدا نشد.`,
      node.start,
      node.end,
      hint,
    );
  };

  const walk = (node: Node): [Node, VType] => {
    switch (node.type) {
      case 'num':
        return [node, 'num'];
      case 'str':
        return [node, 'text'];
      case 'bool':
        return [node, 'bool'];
      case 'null':
        throw new FilterError('برای بررسی مقدار خالی از «IS NULL» استفاده کنید.', node.start, node.end);
      case 'field': {
        const name = resolve(node.name, node);
        if (catalog.constants.has(name)) return [{ ...node, name }, 'num'];
        fields.add(name);
        return [{ ...node, name }, catalog.fields.get(name) as VType];
      }
      case 'call':
        return walkCall(node);
      case 'neg': {
        const [arg, t] = walk(node.arg);
        expectType(t, 'num', node.arg);
        return [{ ...node, arg }, 'num'];
      }
      case 'not': {
        const [arg, t] = walk(node.arg);
        expectType(t, 'bool', node.arg);
        return [{ ...node, arg }, 'bool'];
      }
      case 'arith': {
        const [left, lt] = walk(node.left);
        const [right, rt] = walk(node.right);
        expectType(lt, 'num', node.left);
        expectType(rt, 'num', node.right);
        return [{ ...node, left, right }, 'num'];
      }
      case 'logic': {
        const [left, lt] = walk(node.left);
        const [right, rt] = walk(node.right);
        expectType(lt, 'bool', node.left);
        expectType(rt, 'bool', node.right);
        return [{ ...node, left, right }, 'bool'];
      }
      case 'compare': {
        const [left, lt] = walk(node.left);
        const [right, rt] = walk(node.right);
        comparable(lt, rt, node);
        return [{ ...node, left, right }, 'bool'];
      }
      case 'in': {
        const [arg, t] = walk(node.arg);
        const list = node.list.map((item) => {
          if (
            item.type !== 'num' &&
            item.type !== 'str' &&
            !(item.type === 'neg' && item.arg.type === 'num')
          ) {
            throw new FilterError('فهرست IN فقط عدد یا رشته ثابت می‌پذیرد.', item.start, item.end);
          }
          const [n, it] = walk(item);
          comparable(t, it, item);
          return n;
        });
        return [{ ...node, arg, list }, 'bool'];
      }
      case 'between': {
        const [arg, t] = walk(node.arg);
        const [low, lt] = walk(node.low);
        const [high, ht] = walk(node.high);
        expectType(t, 'num', node.arg);
        expectType(lt, 'num', node.low);
        expectType(ht, 'num', node.high);
        return [{ ...node, arg, low, high }, 'bool'];
      }
      case 'contains': {
        const [arg, t] = walk(node.arg);
        const [sub, st] = walk(node.sub);
        expectType(t, 'text', node.arg);
        expectType(st, 'text', node.sub);
        return [{ ...node, arg, sub }, 'bool'];
      }
      case 'isnull': {
        const [arg] = walk(node.arg);
        return [{ ...node, arg }, 'bool'];
      }
    }
  };

  const walkCall = (node: Extract<Node, { type: 'call' }>): [Node, VType] => {
    const fn = functionByName.get(node.name.toLowerCase());
    if (!fn) {
      const hint = suggest(node.name, functionByName.keys());
      throw new FilterError(
        hint ? `تابع «${node.name}» وجود ندارد. منظورتان «${hint}» است؟` : `تابع «${node.name}» وجود ندارد.`,
        node.start,
        node.end,
        hint,
      );
    }
    if (node.args.length < fn.minArgs || node.args.length > fn.maxArgs) {
      const range = fn.minArgs === fn.maxArgs ? `${fn.minArgs}` : `${fn.minArgs} تا ${fn.maxArgs}`;
      throw new FilterError(`تابع ${fn.signature} به ${range} آرگومان نیاز دارد.`, node.start, node.end);
    }
    const typed = node.args.map(walk);
    typed.forEach(([, t], k) => {
      const want = fn.args[Math.min(k, fn.args.length - 1)] ?? 'any';
      if (want !== 'any') expectType(t, want, node.args[k] as Node);
    });
    const ret = fn.returns === 'arg' ? (typed[1]?.[1] ?? 'num') : fn.returns;
    if (fn.returns === 'arg' && typed[1] && typed[2] && typed[1][1] !== typed[2][1]) {
      const a = typed[1][1] === 'bool' && typed[2][1] === 'num';
      const b = typed[1][1] === 'num' && typed[2][1] === 'bool';
      if (!a && !b) throw new FilterError('دو شاخه if باید هم‌نوع باشند.', node.start, node.end);
    }
    return [{ ...node, name: fn.name, args: typed.map(([n]) => n) }, ret];
  };

  const [resolved, type] = walk(ast);
  return { ast: resolved, type, fields };
}

/** num ↔ bool are interchangeable (true = 1, non-zero = true); text is not. */
function expectType(actual: VType, want: VType, node: Node): void {
  if (actual === want) return;
  if ((actual === 'num' && want === 'bool') || (actual === 'bool' && want === 'num')) return;
  throw new FilterError(
    `در این‌جا مقدار ${TYPE_FA[want]} لازم است، اما مقدار ${TYPE_FA[actual]} آمده.`,
    node.start,
    node.end,
  );
}

function comparable(a: VType, b: VType, node: Node): void {
  const textA = a === 'text';
  const textB = b === 'text';
  if (textA !== textB)
    throw new FilterError(
      'مقایسه مقدار متنی با عددی ممکن نیست؛ رشته را داخل "…" بنویسید.',
      node.start,
      node.end,
    );
}
