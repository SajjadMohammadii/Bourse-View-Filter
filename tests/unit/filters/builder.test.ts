import { describe, it, expect } from 'vitest';
import {
  toExpression,
  fromAst,
  emptyGroup,
  fieldRef,
  type BuilderGroup,
} from '../../../src/core/filters/builderModel';
import { parse } from '../../../src/core/filters/parser';

const group = (op: 'AND' | 'OR', ...children: BuilderGroup['children']): BuilderGroup => ({
  ...emptyGroup(op),
  children,
});
const cond = (field: string, op: string, extra: Record<string, unknown> = {}) =>
  ({ kind: 'cond', id: field + op, enabled: true, field, op, ...extra }) as BuilderGroup['children'][number];

describe('builder model', () => {
  it('serializes nested groups with parentheses and skips disabled nodes', () => {
    const g = group(
      'AND',
      cond('score.technical', '>=', { value: 60 }),
      group('OR', cond('flag.turnaroundQ', 'isTrue'), cond('Exchange', 'in', { values: ['TSE', 'IFB'] })),
      { ...cond('a', '<', { value: 1 }), enabled: false },
    );
    expect(toExpression(g)).toBe(
      'score.technical >= 60 AND (flag.turnaroundQ OR Exchange IN ("TSE", "IFB"))',
    );
  });
  it('serializes every operator', () => {
    expect(toExpression(group('AND', cond('x', 'between', { value: 0, value2: 7 })))).toBe(
      'x BETWEEN 0 AND 7',
    );
    expect(toExpression(group('AND', cond('x', 'notIn', { values: [1, 2] })))).toBe('x NOT IN (1, 2)');
    expect(toExpression(group('AND', cond('x', 'isNull')))).toBe('x IS NULL');
    expect(toExpression(group('AND', cond('x', 'notNull')))).toBe('x IS NOT NULL');
    expect(toExpression(group('AND', cond('x', 'isFalse')))).toBe('NOT x');
    expect(toExpression(group('AND', cond('Company', 'contains', { value: 'فولاد' })))).toBe(
      'Company CONTAINS "فولاد"',
    );
    expect(toExpression(emptyGroup())).toBe('');
  });
  it('brackets non-identifier field names', () => {
    expect(fieldRef('OP-Margin-MRQ-3qGR')).toBe('[OP-Margin-MRQ-3qGR]');
    expect(fieldRef('factor.technical.T1')).toBe('factor.technical.T1');
  });
  it('round-trips text → builder → text', () => {
    const src = 'a > 1 AND (b IS NULL OR c IN ("x", "y")) AND d BETWEEN -1 AND 2 AND NOT e';
    const g = fromAst(parse(src));
    expect(g).not.toBeNull();
    expect(toExpression(g as BuilderGroup)).toBe(src);
  });
  it('returns null for expressions the builder cannot represent', () => {
    expect(fromAst(parse('a + b > 1'))).toBeNull();
    expect(fromAst(parse('NOT (a > 1)'))).toBeNull();
  });
});
