import { toLatinDigits } from '../utils/digits';

/** Tokens that mean "no value" in the screener export. */
export const MISSING_TOKENS: ReadonlySet<string> = new Set(['', '-', '--', '---', '----', 'n/a', 'na', 'nan', 'null', '#n/a']);

export type ParsedCell = { kind: 'null' } | { kind: 'num'; value: number } | { kind: 'text'; value: string };

const NULL: ParsedCell = { kind: 'null' };
const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?%?$/i;

/** Parses a raw cell into null / number / text (PLAN.md §4 step 3). */
export function parseCell(raw: unknown): ParsedCell {
  if (raw === null || raw === undefined) return NULL;
  if (typeof raw === 'number') return Number.isFinite(raw) ? { kind: 'num', value: raw } : NULL;
  if (typeof raw === 'boolean') return { kind: 'num', value: raw ? 1 : 0 };
  if (raw instanceof Date) return { kind: 'text', value: raw.toISOString() };
  const s = String(raw).trim();
  if (MISSING_TOKENS.has(s.toLowerCase())) return NULL;
  const latin = toLatinDigits(s).replace(/,/g, '');
  if (NUMERIC.test(latin)) {
    const isPct = latin.endsWith('%');
    const n = Number(isPct ? latin.slice(0, -1) : latin);
    if (Number.isFinite(n)) return { kind: 'num', value: isPct ? n / 100 : n };
  }
  return { kind: 'text', value: s.replace(/\s+/g, ' ') };
}

/** Numeric view: anything non-numeric becomes null. */
export function parseNumber(raw: unknown): number | null {
  const c = parseCell(raw);
  return c.kind === 'num' ? c.value : null;
}
