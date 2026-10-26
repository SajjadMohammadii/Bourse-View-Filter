/** Canonical column key: strip newlines, collapse whitespace, trim (PLAN.md §1.1). */
export function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/[\r\n\t]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface HeaderPlan {
  /** Kept columns: source index → canonical id. */
  columns: Array<{ index: number; id: string; original: string }>;
  dropped: string[];
  renamed: Array<{ from: string; to: string }>;
}

const UNNAMED = /^unnamed(: ?\d+)?$/i;

/**
 * Decides which columns to keep and under which canonical id.
 * Unnamed columns are dropped when entirely empty, otherwise named `col_<n>`.
 * Duplicate ids get a `__2`, `__3`… suffix.
 */
export function planHeaders(headers: unknown[], isColumnEmpty: (index: number) => boolean): HeaderPlan {
  const plan: HeaderPlan = { columns: [], dropped: [], renamed: [] };
  const seen = new Map<string, number>();
  headers.forEach((raw, index) => {
    const original = raw === null || raw === undefined ? '' : String(raw);
    let id = normalizeHeader(raw);
    if (id === '' || UNNAMED.test(id)) {
      if (isColumnEmpty(index)) {
        plan.dropped.push(original || `#${index + 1}`);
        return;
      }
      id = `col_${index + 1}`;
    }
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    if (count > 1) id = `${id}__${count}`;
    if (id !== original) plan.renamed.push({ from: original, to: id });
    plan.columns.push({ index, id, original });
  });
  return plan;
}
