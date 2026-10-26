import type { ArithOp, CompareOp, Node } from './ast';
import { FilterError } from './errors';
import { tokenize, type LexOptions, type Token } from './lexer';

/** Pratt parser for the grammar in PLAN.md §11.2. */
export function parse(input: string, opts: LexOptions = {}): Node {
  const p = new Parser(tokenize(input, opts));
  if (p.peek().kind === 'eof') throw new FilterError('عبارت خالی است.', 0);
  const node = p.expr(0);
  const t = p.peek();
  if (t.kind !== 'eof') throw new FilterError(`«${t.text}» در این‌جا انتظار نمی‌رفت.`, t.start, t.end);
  return node;
}

const COMPARE: Record<string, CompareOp> = {
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '=': '=',
  '==': '=',
  '!=': '!=',
  '<>': '!=',
};

// Binding powers.
const BP = { OR: 1, AND: 2, NOT: 3, COMPARE: 4, ADD: 5, MUL: 6, UNARY: 7, POW: 8 } as const;

class Parser {
  private i = 0;
  constructor(private readonly tokens: Token[]) {}

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)] as Token;
  }

  private next(): Token {
    const t = this.peek();
    this.i++;
    return t;
  }

  private isKw(text: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === 'kw' && t.text === text;
  }

  private expect(kind: Token['kind'], what: string): Token {
    const t = this.peek();
    if (t.kind !== kind)
      throw new FilterError(`${what} انتظار می‌رفت، اما «${t.text || 'پایان عبارت'}» آمد.`, t.start, t.end);
    return this.next();
  }

  expr(minBp: number): Node {
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      const bp = this.infixBp(t);
      if (bp === null || bp <= minBp) break;
      left = this.infix(left, bp);
    }
    return left;
  }

  private infixBp(t: Token): number | null {
    if (t.kind === 'kw') {
      if (t.text === 'OR') return BP.OR;
      if (t.text === 'AND') return BP.AND;
      if (['IN', 'BETWEEN', 'CONTAINS', 'IS'].includes(t.text)) return BP.COMPARE;
      if (t.text === 'NOT' && (this.isKw('IN', 1) || this.isKw('BETWEEN', 1))) return BP.COMPARE;
      return null;
    }
    if (t.kind !== 'op') return null;
    if (t.text === '||') return BP.OR;
    if (t.text === '&&') return BP.AND;
    if (t.text in COMPARE) return BP.COMPARE;
    if (t.text === '+' || t.text === '-') return BP.ADD;
    if (t.text === '*' || t.text === '/' || t.text === '%') return BP.MUL;
    if (t.text === '^') return BP.POW;
    return null;
  }

  private prefix(): Node {
    const t = this.next();
    switch (t.kind) {
      case 'num':
        return { type: 'num', value: t.value as number, start: t.start, end: t.end };
      case 'str':
        return { type: 'str', value: t.text, start: t.start, end: t.end };
      case 'ident':
        return this.identOrCall(t);
      case 'lparen': {
        const inner = this.expr(0);
        const close = this.expect('rparen', '«)»');
        return { ...inner, start: t.start, end: close.end };
      }
      case 'kw':
        if (t.text === 'TRUE' || t.text === 'FALSE')
          return { type: 'bool', value: t.text === 'TRUE', start: t.start, end: t.end };
        if (t.text === 'NULL') return { type: 'null', start: t.start, end: t.end };
        if (t.text === 'NOT') return this.unary('not', t, BP.NOT);
        // `contains(s, sub)` is also a function; the keyword form is `s CONTAINS sub`.
        if (t.text === 'CONTAINS' && this.peek().kind === 'lparen')
          return this.identOrCall({ ...t, kind: 'ident', text: 'contains' });
        break;
      case 'op':
        if (t.text === '-') return this.unary('neg', t, BP.UNARY);
        if (t.text === '+') return this.expr(BP.UNARY);
        if (t.text === '!') return this.unary('not', t, BP.NOT);
        break;
      default:
        break;
    }
    throw new FilterError(
      t.kind === 'eof' ? 'عبارت ناتمام است.' : `«${t.text}» در این‌جا انتظار نمی‌رفت.`,
      t.start,
      t.end,
    );
  }

  private unary(type: 'neg' | 'not', t: Token, bp: number): Node {
    // Unary minus binds tighter than '*' but looser than '^': -2^2 = -(2^2).
    const arg = this.expr(type === 'neg' ? bp - 0.5 : bp - 1);
    return { type, arg, start: t.start, end: arg.end };
  }

  private identOrCall(t: Token): Node {
    if (this.peek().kind !== 'lparen') return { type: 'field', name: t.text, start: t.start, end: t.end };
    this.next();
    const args: Node[] = [];
    if (this.peek().kind !== 'rparen') {
      do args.push(this.expr(0));
      while (this.peek().kind === 'comma' && this.next());
    }
    const close = this.expect('rparen', '«)» پایان آرگومان‌ها');
    return { type: 'call', name: t.text, args, start: t.start, end: close.end };
  }

  private infix(left: Node, bp: number): Node {
    const t = this.next();
    const span = (end: number) => ({ start: left.start, end });
    if (t.kind === 'kw' || t.text === '||' || t.text === '&&') return this.keywordInfix(left, t, bp);
    if (t.text in COMPARE) {
      const right = this.expr(BP.COMPARE);
      return { type: 'compare', op: COMPARE[t.text] as CompareOp, left, right, ...span(right.end) };
    }
    // '^' is right-associative.
    const right = this.expr(t.text === '^' ? bp - 1 : bp);
    return { type: 'arith', op: t.text as ArithOp, left, right, ...span(right.end) };
  }

  private keywordInfix(left: Node, t: Token, bp: number): Node {
    const op = t.text === '||' ? 'OR' : t.text === '&&' ? 'AND' : t.text;
    if (op === 'OR' || op === 'AND') {
      const right = this.expr(bp);
      return { type: 'logic', op, left, right, start: left.start, end: right.end };
    }
    let negated = false;
    let kw = op;
    if (kw === 'NOT') {
      negated = true;
      kw = this.next().text;
    }
    if (kw === 'IN') return this.inList(left, negated);
    if (kw === 'BETWEEN') {
      const low = this.expr(BP.COMPARE);
      if (!this.isKw('AND'))
        throw new FilterError('بعد از BETWEEN باید «AND» بیاید.', this.peek().start, this.peek().end);
      this.next();
      const high = this.expr(BP.COMPARE);
      return { type: 'between', arg: left, low, high, negated, start: left.start, end: high.end };
    }
    if (kw === 'CONTAINS') {
      const sub = this.expr(BP.COMPARE);
      return { type: 'contains', arg: left, sub, start: left.start, end: sub.end };
    }
    // IS [NOT] NULL
    const not = this.isKw('NOT');
    if (not) this.next();
    const nullTok = this.peek();
    if (!this.isKw('NULL'))
      throw new FilterError('بعد از IS باید «NULL» یا «NOT NULL» بیاید.', nullTok.start, nullTok.end);
    this.next();
    return { type: 'isnull', arg: left, negated: not, start: left.start, end: nullTok.end };
  }

  private inList(left: Node, negated: boolean): Node {
    this.expect('lparen', '«(» پس از IN');
    const list: Node[] = [];
    do list.push(this.expr(BP.COMPARE));
    while (this.peek().kind === 'comma' && this.next());
    const close = this.expect('rparen', '«)» پایان فهرست IN');
    return { type: 'in', arg: left, list, negated, start: left.start, end: close.end };
  }
}
