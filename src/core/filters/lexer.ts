import { toLatinDigits } from '../utils/digits';
import { FilterError } from './errors';

export type TokenKind = 'num' | 'str' | 'ident' | 'kw' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

export interface Token {
  kind: TokenKind;
  /** Keyword/operator text (canonical, upper-case for keywords), identifier name or string value. */
  text: string;
  value?: number;
  start: number;
  end: number;
}

const KEYWORDS: Record<string, string> = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  IN: 'IN',
  BETWEEN: 'BETWEEN',
  CONTAINS: 'CONTAINS',
  IS: 'IS',
  NULL: 'NULL',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  و: 'AND',
  یا: 'OR',
  نه: 'NOT',
};

/** Unit suffixes allowed right after a number (PLAN.md §11.2). */
const SUFFIX: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, همت: 1e13 };

const OPS = ['>=', '<=', '<>', '!=', '==', '&&', '||', '>', '<', '=', '+', '-', '*', '/', '%', '^', '!'];

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isIdStart = (c: string | undefined) => c !== undefined && /[A-Za-z_]/.test(c);
const isIdChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_.]/.test(c);
const isPersianLetter = (c: string | undefined) => c !== undefined && /[؀-ۿ]/.test(c) && !/[۰-۹٠-٩]/.test(c);

export interface LexOptions {
  /** Known field names: lets identifiers include '-' (e.g. OP-Margin-MRQ-3qGR) when the result is a real field. */
  knownNames?: ReadonlySet<string>;
}

export function tokenize(input: string, opts: LexOptions = {}): Token[] {
  // Digit conversion keeps positions: each Persian digit maps to exactly one Latin char.
  const src = toLatinDigits(input).replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      i = lexNumber(src, i, tokens);
    } else if (c === '"' || c === "'") {
      i = lexString(src, i, c, tokens);
    } else if (c === '[') {
      const close = src.indexOf(']', i + 1);
      if (close < 0) throw new FilterError('براکت «[» بسته نشده است.', i);
      tokens.push({ kind: 'ident', text: src.slice(i + 1, close).trim(), start, end: close + 1 });
      i = close + 1;
    } else if (isIdStart(c)) {
      i = lexIdent(src, i, tokens, opts.knownNames);
    } else if (isPersianLetter(c)) {
      let j = i;
      while (isPersianLetter(src[j]) || src[j] === '‌') j++;
      const word = src.slice(i, j);
      const kw = KEYWORDS[word];
      if (!kw)
        throw new FilterError(
          `واژه «${word}» شناخته نشد؛ از و / یا / نه یا نام انگلیسی ستون استفاده کنید.`,
          i,
          j,
        );
      tokens.push({ kind: 'kw', text: kw, start, end: j });
      i = j;
    } else if (c === '(' || c === ')' || c === ',') {
      tokens.push({
        kind: c === '(' ? 'lparen' : c === ')' ? 'rparen' : 'comma',
        text: c,
        start,
        end: i + 1,
      });
      i++;
    } else {
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new FilterError(`نویسه «${c}» مجاز نیست.`, i);
      tokens.push({ kind: 'op', text: op, start, end: i + op.length });
      i += op.length;
    }
  }
  tokens.push({ kind: 'eof', text: '', start: src.length, end: src.length });
  return tokens;
}

function lexNumber(src: string, i: number, out: Token[]): number {
  const start = i;
  const m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(src.slice(i));
  const raw = m?.[0] ?? '';
  let value = Number(raw);
  i += raw.length;
  if (src[i] === '%') {
    value /= 100;
    i++;
  } else {
    const rest = src.slice(i);
    const sp = /^\s*همت/.exec(rest);
    const letter = /^[KMBT](?![A-Za-z0-9_])/.exec(rest);
    if (sp) {
      value *= SUFFIX['همت'] as number;
      i += sp[0].length;
    } else if (letter) {
      value *= SUFFIX[letter[0]] as number;
      i += 1;
    }
  }
  out.push({ kind: 'num', text: src.slice(start, i), value, start, end: i });
  return i;
}

function lexString(src: string, i: number, quote: string, out: Token[]): number {
  const start = i;
  let j = i + 1;
  let text = '';
  while (j < src.length && src[j] !== quote) {
    if (src[j] === '\\' && j + 1 < src.length) j++;
    text += src[j];
    j++;
  }
  if (j >= src.length) throw new FilterError('رشته بسته نشده است.', start);
  out.push({ kind: 'str', text, start, end: j + 1 });
  return j + 1;
}

function lexIdent(src: string, i: number, out: Token[], known?: ReadonlySet<string>): number {
  const start = i;
  let j = i + 1;
  while (isIdChar(src[j])) j++;
  // Greedily extend through '-' segments while the longer name is a known field.
  if (known) {
    let k = j;
    while (src[k] === '-' && isIdChar(src[k + 1])) {
      let e = k + 1;
      while (isIdChar(src[e])) e++;
      if (known.has(src.slice(start, e)) || [...known].some((n) => n.startsWith(src.slice(start, e) + '-'))) {
        k = e;
        if (known.has(src.slice(start, e))) j = e;
      } else break;
    }
  }
  const word = src.slice(start, j);
  const kw = KEYWORDS[word.toUpperCase()];
  out.push(kw ? { kind: 'kw', text: kw, start, end: j } : { kind: 'ident', text: word, start, end: j });
  return j;
}
