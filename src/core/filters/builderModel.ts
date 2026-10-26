import type { Node } from './ast';

/** Visual filter builder tree (PLAN.md §11.6). Builder → text always; text → builder when the shape fits. */

export type CondOp =
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!='
  | 'between'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'isNull'
  | 'notNull'
  | 'isTrue'
  | 'isFalse';

export interface BuilderCond {
  kind: 'cond';
  id: string;
  enabled: boolean;
  field: string;
  op: CondOp;
  value?: number | string;
  value2?: number;
  values?: Array<string | number>;
}

export interface BuilderGroup {
  kind: 'group';
  id: string;
  enabled: boolean;
  op: 'AND' | 'OR';
  children: BuilderNode[];
}

export type BuilderNode = BuilderCond | BuilderGroup;

let seq = 0;
export const newId = (): string => `b${++seq}`;

export const emptyGroup = (op: 'AND' | 'OR' = 'AND'): BuilderGroup => ({
  kind: 'group',
  id: newId(),
  enabled: true,
  op,
  children: [],
});

/** Field reference, bracketed when the name is not a plain identifier. */
export function fieldRef(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : `[${name}]`;
}

const literal = (v: number | string | undefined): string =>
  typeof v === 'number' ? formatNumber(v) : `"${String(v ?? '').replace(/"/g, '\\"')}"`;

function formatNumber(v: number): string {
  return Number.isFinite(v) ? String(Number(v.toPrecision(12))) : '0';
}

function condText(c: BuilderCond): string {
  const f = fieldRef(c.field);
  switch (c.op) {
    case 'between':
      return `${f} BETWEEN ${literal(c.value)} AND ${literal(c.value2)}`;
    case 'in':
    case 'notIn':
      return `${f} ${c.op === 'in' ? 'IN' : 'NOT IN'} (${(c.values ?? []).map(literal).join(', ')})`;
    case 'contains':
      return `${f} CONTAINS ${literal(String(c.value ?? ''))}`;
    case 'isNull':
      return `${f} IS NULL`;
    case 'notNull':
      return `${f} IS NOT NULL`;
    case 'isTrue':
      return f;
    case 'isFalse':
      return `NOT ${f}`;
    default:
      return `${f} ${c.op} ${literal(c.value)}`;
  }
}

/** Serializes enabled nodes; empty groups disappear. */
export function toExpression(node: BuilderNode, nested = false): string {
  if (!node.enabled) return '';
  if (node.kind === 'cond') return condText(node);
  const parts = node.children.map((c) => toExpression(c, true)).filter(Boolean);
  if (!parts.length) return '';
  const joined = parts.join(` ${node.op} `);
  return nested && parts.length > 1 ? `(${joined})` : joined;
}

/** Converts a parsed AST back to a builder tree; null when the expression is too complex ("advanced mode"). */
export function fromAst(ast: Node): BuilderGroup | null {
  if (ast.type === 'logic') {
    const group: BuilderGroup = { kind: 'group', id: newId(), enabled: true, op: ast.op, children: [] };
    for (const part of flatten(ast, ast.op)) {
      const child = part.type === 'logic' ? fromAst(part) : condFromAst(part);
      if (!child) return null;
      group.children.push(child);
    }
    return group;
  }
  const cond = condFromAst(ast);
  return cond ? { kind: 'group', id: newId(), enabled: true, op: 'AND', children: [cond] } : null;
}

function flatten(node: Node, op: 'AND' | 'OR'): Node[] {
  if (node.type === 'logic' && node.op === op) return [...flatten(node.left, op), ...flatten(node.right, op)];
  return [node];
}

function constValue(n: Node): number | string | null {
  if (n.type === 'num') return n.value;
  if (n.type === 'str') return n.value;
  if (n.type === 'neg' && n.arg.type === 'num') return -n.arg.value;
  return null;
}

function condFromAst(n: Node): BuilderCond | null {
  const base = { kind: 'cond' as const, id: newId(), enabled: true };
  switch (n.type) {
    case 'field':
      return { ...base, field: n.name, op: 'isTrue' };
    case 'not':
      return n.arg.type === 'field' ? { ...base, field: n.arg.name, op: 'isFalse' } : null;
    case 'compare': {
      const v = constValue(n.right);
      return n.left.type === 'field' && v !== null
        ? { ...base, field: n.left.name, op: n.op, value: v }
        : null;
    }
    case 'between': {
      const lo = constValue(n.low);
      const hi = constValue(n.high);
      if (n.negated || n.arg.type !== 'field' || typeof lo !== 'number' || typeof hi !== 'number')
        return null;
      return { ...base, field: n.arg.name, op: 'between', value: lo, value2: hi };
    }
    case 'in': {
      const values = n.list.map(constValue);
      if (n.arg.type !== 'field' || values.some((v) => v === null)) return null;
      return {
        ...base,
        field: n.arg.name,
        op: n.negated ? 'notIn' : 'in',
        values: values as Array<string | number>,
      };
    }
    case 'contains': {
      const v = constValue(n.sub);
      return n.arg.type === 'field' && typeof v === 'string'
        ? { ...base, field: n.arg.name, op: 'contains', value: v }
        : null;
    }
    case 'isnull':
      return n.arg.type === 'field'
        ? { ...base, field: n.arg.name, op: n.negated ? 'notNull' : 'isNull' }
        : null;
    default:
      return null;
  }
}
