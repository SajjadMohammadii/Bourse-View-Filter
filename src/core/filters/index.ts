import type { Dataset, Result } from '../types';
import { err, ok } from '../types';
import type { Node } from './ast';
import { analyze, type FieldCatalog } from './analyzer';
import { evaluate, truthy } from './evaluator';
import { FilterError } from './errors';
import { functions, nums, type EvalContext, type VType } from './functions';
import { parse } from './parser';

export type { FieldCatalog } from './analyzer';
export type { EvalContext } from './functions';

export interface Compiled {
  source: string;
  ast: Node;
  type: VType;
  fields: Set<string>;
}

export interface FilterErrorInfo {
  start: number;
  end: number;
  suggestion?: string;
}

/** Named constants usable in expressions. */
export function defaultConstants(inflation: number, riskFreeRate: number): Record<string, number> {
  return { INFLATION: inflation, RISK_FREE: riskFreeRate };
}

export function catalogFromDataset(ds: Dataset, constants: Record<string, number> = {}): FieldCatalog {
  const fields = new Map<string, VType>();
  for (const k of Object.keys(ds.num)) fields.set(k, ds.meta[k]?.unit === 'flag' ? 'bool' : 'num');
  for (const k of Object.keys(ds.text)) fields.set(k, 'text');
  return { fields, constants: new Map(Object.entries(constants)) };
}

/** Parses and type-checks an expression; errors carry the character span. */
export function compile(source: string, catalog: FieldCatalog): Result<Compiled> {
  try {
    const names = new Set(catalog.fields.keys());
    const a = analyze(parse(source, { knownNames: names }), catalog);
    return ok({ source, ast: a.ast, type: a.type, fields: a.fields });
  } catch (e) {
    if (e instanceof FilterError) {
      const info: FilterErrorInfo = { start: e.start, end: e.end, suggestion: e.suggestion };
      return err('FILTER_SYNTAX', e.message, info);
    }
    throw e;
  }
}

/** Row mask (1 = passes). A numeric expression passes where it is non-zero. */
export function runFilter(c: Compiled, ctx: EvalContext): Uint8Array {
  return truthy(evaluate(c.ast, ctx));
}

/** Numeric column for custom metrics; booleans become 0/1, text is rejected at compile time by callers. */
export function evaluateNumeric(c: Compiled, ctx: EvalContext): Float64Array {
  return nums(evaluate(c.ast, ctx));
}

export interface Completion {
  label: string;
  kind: 'field' | 'function' | 'keyword' | 'constant';
  detail?: string;
}

const KEYWORDS = ['AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'CONTAINS', 'IS NULL', 'IS NOT NULL', 'TRUE', 'FALSE'];

/** Completion candidates for the word ending at the cursor (PLAN.md §11.8). */
export function completions(
  prefix: string,
  catalog: FieldCatalog,
  labels: (id: string) => string | undefined,
  limit = 30,
): Completion[] {
  const p = prefix.toLowerCase();
  if (!p) return [];
  const out: Completion[] = [];
  for (const name of catalog.fields.keys()) {
    const label = labels(name);
    if (name.toLowerCase().includes(p) || label?.includes(prefix))
      out.push({ label: name, kind: 'field', detail: label });
  }
  for (const f of functions)
    if (f.name.startsWith(p)) out.push({ label: `${f.name}(`, kind: 'function', detail: f.description });
  for (const k of KEYWORDS) if (k.toLowerCase().startsWith(p)) out.push({ label: k, kind: 'keyword' });
  for (const c of catalog.constants.keys())
    if (c.toLowerCase().startsWith(p)) out.push({ label: c, kind: 'constant' });
  const starts = (c: Completion) => (c.label.toLowerCase().startsWith(p) ? 0 : 1);
  return out.sort((a, b) => starts(a) - starts(b) || a.label.length - b.label.length).slice(0, limit);
}
