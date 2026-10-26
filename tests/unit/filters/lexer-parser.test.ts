import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/core/filters/lexer';
import { parse } from '../../../src/core/filters/parser';
import type { Node } from '../../../src/core/filters/ast';
import { FilterError } from '../../../src/core/filters/errors';

/** Compact S-expression view of an AST for readable assertions. */
function s(n: Node): string {
  switch (n.type) {
    case 'num':
      return String(n.value);
    case 'str':
      return JSON.stringify(n.value);
    case 'bool':
      return String(n.value);
    case 'null':
      return 'null';
    case 'field':
      return n.name;
    case 'call':
      return `${n.name}(${n.args.map(s).join(' ')})`;
    case 'neg':
      return `(- ${s(n.arg)})`;
    case 'not':
      return `(not ${s(n.arg)})`;
    case 'arith':
    case 'logic':
    case 'compare':
      return `(${n.op} ${s(n.left)} ${s(n.right)})`;
    case 'in':
      return `(${n.negated ? 'notin' : 'in'} ${s(n.arg)} [${n.list.map(s).join(' ')}])`;
    case 'between':
      return `(between ${s(n.arg)} ${s(n.low)} ${s(n.high)})`;
    case 'contains':
      return `(contains ${s(n.arg)} ${s(n.sub)})`;
    case 'isnull':
      return `(${n.negated ? 'notnull' : 'isnull'} ${s(n.arg)})`;
  }
}
const p = (src: string, known?: string[]) => s(parse(src, known ? { knownNames: new Set(known) } : {}));

describe('lexer', () => {
  it('reads numbers with percent and unit suffixes', () => {
    const vals = tokenize('20% 1.5K 3M 2B 1T 5همت 5 همت .5')
      .filter((t) => t.kind === 'num')
      .map((t) => t.value);
    expect(vals).toEqual([0.2, 1500, 3e6, 2e9, 1e12, 5e13, 5e13, 0.5]);
  });
  it('converts Persian and Arabic digits, and Persian decimal separator', () => {
    expect(
      tokenize('۱۲٫۵ ٣٤')
        .filter((t) => t.kind === 'num')
        .map((t) => t.value),
    ).toEqual([12.5, 34]);
  });
  it('maps Persian keywords and is case-insensitive for English ones', () => {
    expect(
      tokenize('a و b یا نه c and d')
        .filter((t) => t.kind === 'kw')
        .map((t) => t.text),
    ).toEqual(['AND', 'OR', 'NOT', 'AND']);
  });
  it('reads dotted identifiers and bracketed names', () => {
    const t = tokenize('factor.technical.T1 [OP-Margin-MRQ-3qGR]');
    expect(t.map((x) => x.text).slice(0, 2)).toEqual(['factor.technical.T1', 'OP-Margin-MRQ-3qGR']);
  });
  it('extends identifiers through "-" only for known names', () => {
    expect(p('OP-Margin-MRQ-3qGR > 0', ['OP-Margin-MRQ-3qGR'])).toBe('(> OP-Margin-MRQ-3qGR 0)');
    expect(p('NI_MRQ-NI_FY', ['NI_MRQ', 'NI_FY'])).toBe('(- NI_MRQ NI_FY)');
  });
  it('reads strings in both quote styles with escapes', () => {
    expect(
      tokenize(`"TSE" 'خدمات مالی' "a\\"b"`)
        .filter((t) => t.kind === 'str')
        .map((t) => t.text),
    ).toEqual(['TSE', 'خدمات مالی', 'a"b']);
  });
  it('normalizes Arabic yeh/kaf in keywords', () => {
    expect(tokenize('a يا b')[1]?.text).toBe('OR');
  });
  it('rejects unknown characters and Persian words with a position', () => {
    expect(() => tokenize('a $ b')).toThrow(FilterError);
    try {
      tokenize('a سلام');
    } catch (e) {
      expect((e as FilterError).start).toBe(2);
    }
  });
  it('rejects unterminated strings and brackets', () => {
    expect(() => tokenize('"abc')).toThrow('رشته بسته نشده');
    expect(() => tokenize('[abc')).toThrow('براکت');
  });
});

describe('parser precedence', () => {
  it('* binds tighter than +', () => expect(p('1 + 2 * 3')).toBe('(+ 1 (* 2 3))'));
  it('left associative - and /', () => {
    expect(p('8 - 3 - 2')).toBe('(- (- 8 3) 2)');
    expect(p('8 / 4 / 2')).toBe('(/ (/ 8 4) 2)');
  });
  it('^ is right associative and tighter than unary minus', () => {
    expect(p('2 ^ 3 ^ 2')).toBe('(^ 2 (^ 3 2))');
    expect(p('-2 ^ 2')).toBe('(- (^ 2 2))');
    expect(p('2 ^ -1')).toBe('(^ 2 (- 1))');
  });
  it('comparison binds tighter than AND, AND tighter than OR', () => {
    expect(p('a > 1 AND b < 2 OR c = 3')).toBe('(OR (AND (> a 1) (< b 2)) (= c 3))');
    expect(p('a OR b AND c')).toBe('(OR a (AND b c))');
  });
  it('NOT applies to a comparison but not across AND', () => {
    expect(p('NOT a = 1 AND b')).toBe('(AND (not (= a 1)) b)');
    expect(p('!a || b && c')).toBe('(OR (not a) (AND b c))');
  });
  it('parentheses override precedence', () => expect(p('(1 + 2) * 3')).toBe('(* (+ 1 2) 3)'));
  it('normalizes == and <> operators', () => {
    expect(p('a == 1')).toBe('(= a 1)');
    expect(p('a <> 1')).toBe('(!= a 1)');
  });
  it('parses IN / NOT IN lists', () => {
    expect(p('Exchange IN ("TSE", "IFB")')).toBe('(in Exchange ["TSE" "IFB"])');
    expect(p('x NOT IN (1, 2)')).toBe('(notin x [1 2])');
  });
  it('parses BETWEEN whose AND does not split the expression', () => {
    expect(p('PtoE_ttm BETWEEN 0 AND 7 AND x > 1')).toBe('(AND (between PtoE_ttm 0 7) (> x 1))');
  });
  it('parses CONTAINS, IS NULL and IS NOT NULL', () => {
    expect(p('Company CONTAINS "فولاد"')).toBe('(contains Company "فولاد")');
    expect(p('Rev_1M IS NULL')).toBe('(isnull Rev_1M)');
    expect(p('Rev_1M IS NOT NULL')).toBe('(notnull Rev_1M)');
  });
  it('parses function calls with zero, one or many arguments', () => {
    expect(p('f()')).toBe('f()');
    expect(p('round(x, 2) > max(a, b, c)')).toBe('(> round(x 2) max(a b c))');
  });
  it('parses literals true/false/null', () =>
    expect(p('a = true OR b = null')).toBe('(OR (= a true) (= b null))'));
  it('parses the acceptance expression', () => {
    expect(p('NI_MRQ / NI_FY > 35% AND Exchange IN ("TSE","IFB") AND score.technical >= 60')).toBe(
      '(AND (AND (> (/ NI_MRQ NI_FY) 0.35) (in Exchange ["TSE" "IFB"])) (>= score.technical 60))',
    );
  });
  it('accepts Persian keywords end to end', () => expect(p('a > ۱ و نه b')).toBe('(AND (> a 1) (not b))'));
});

describe('parser errors', () => {
  const errAt = (src: string) => {
    try {
      parse(src);
    } catch (e) {
      return e as FilterError;
    }
    throw new Error('no error');
  };
  it('empty input', () => expect(errAt('  ').message).toContain('خالی'));
  it('dangling operator', () => expect(errAt('a >').message).toContain('ناتمام'));
  it('missing closing paren', () => expect(errAt('(a > 1').message).toContain('«)»'));
  it('trailing token', () => expect(errAt('a > 1 2').start).toBe(6));
  it('BETWEEN without AND', () => expect(errAt('a BETWEEN 1 2').message).toContain('AND'));
  it('IS without NULL', () => expect(errAt('a IS 3').message).toContain('NULL'));
  it('IN without list', () => expect(errAt('a IN 3').message).toContain('«(»'));
});
