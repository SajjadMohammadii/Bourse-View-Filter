import { fieldRef } from '../core/filters/builderModel';

/** Quick filter chips shown above every page (PLAN.md §11.6). Amounts are in rial. */
export interface QuickFilters {
  exchanges: string[];
  sectors: string[];
  industries: string[];
  minMarketCap: number | null;
  minAvgValue: number | null;
  minConfidence: number | null;
}

export const emptyQuickFilters: QuickFilters = {
  exchanges: [],
  sectors: [],
  industries: [],
  minMarketCap: null,
  minAvgValue: null,
  minConfidence: null,
};

const list = (xs: string[]) => xs.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(', ');

/** Quick chips → filter-language expression (one evaluation path for everything). */
export function quickToExpression(q: QuickFilters): string {
  const parts: string[] = [];
  if (q.exchanges.length) parts.push(`Exchange IN (${list(q.exchanges)})`);
  if (q.sectors.length) parts.push(`Sector IN (${list(q.sectors)})`);
  if (q.industries.length) parts.push(`Industry IN (${list(q.industries)})`);
  if (q.minMarketCap !== null) parts.push(`MarketCap >= ${q.minMarketCap}`);
  if (q.minAvgValue !== null) parts.push(`AvgVal_20D >= ${q.minAvgValue}`);
  if (q.minConfidence !== null) parts.push(`${fieldRef('conf.composite')} >= ${q.minConfidence}`);
  return parts.join(' AND ');
}

/** AND-combines non-empty expressions, parenthesizing each. */
export function combineExpressions(...exprs: string[]): string {
  const parts = exprs.map((e) => e.trim()).filter(Boolean);
  return parts.length <= 1 ? (parts[0] ?? '') : parts.map((p) => `(${p})`).join(' AND ');
}

export function quickFilterCount(q: QuickFilters): number {
  return (
    (q.exchanges.length ? 1 : 0) +
    (q.sectors.length ? 1 : 0) +
    (q.industries.length ? 1 : 0) +
    (q.minMarketCap !== null ? 1 : 0) +
    (q.minAvgValue !== null ? 1 : 0) +
    (q.minConfidence !== null ? 1 : 0)
  );
}
