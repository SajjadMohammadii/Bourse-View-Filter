import type { Category, Dataset, Direction, Unit } from '../types';
import { compile, catalogFromDataset, evaluateNumeric, type Compiled, type EvalContext } from '../filters';
import { topoSort } from '../utils/graph';

/** User-defined metric written in the filter language (PLAN.md §11.5). */
export interface CustomMetricDef {
  /** Always starts with C_. */
  id: string;
  label: string;
  expression: string;
  unit: Unit;
  direction: Direction;
  category?: Category;
  description?: string;
}

export const CUSTOM_PREFIX = 'C_';

/** Score-layer fields are computed after custom metrics, so custom metrics cannot read them. */
const SCORE_PREFIXES = [
  'score.',
  'factor.',
  'conf.',
  'rank.',
  'rankInIndustry.',
  'grade.',
  'flag.',
  'eligible.',
  'delta.',
  'prev.',
];

export function normalizeCustomId(raw: string): string {
  const clean = raw.trim().replace(/[^A-Za-z0-9_]/g, '_');
  return clean.startsWith(CUSTOM_PREFIX) ? clean : `${CUSTOM_PREFIX}${clean}`;
}

export interface CustomRunResult {
  dataset: Dataset;
  /** metric id → Persian error; failing metrics are skipped, the rest still compute. */
  errors: Record<string, string>;
}

type EvalOptions = Pick<EvalContext, 'inflation' | 'constants'>;

/**
 * Compiles every definition against raw + derived fields (+ other custom ids), orders them by
 * dependency, rejects cycles and score references, and adds the resulting columns.
 */
export function computeCustomMetrics(
  input: Dataset,
  defs: readonly CustomMetricDef[],
  opts: EvalOptions,
): CustomRunResult {
  const errors: Record<string, string> = {};
  const ds: Dataset = { ...input, num: { ...input.num }, meta: { ...input.meta } };
  const catalog = catalogFromDataset(ds, opts.constants);
  const fields = new Map(catalog.fields);
  for (const d of defs) fields.set(d.id, 'num');
  const fullCatalog = { ...catalog, fields };

  const compiled = new Map<string, Compiled>();
  for (const d of defs) {
    const c = compileOne(d, fullCatalog);
    if (typeof c === 'string') errors[d.id] = c;
    else compiled.set(d.id, c);
  }

  const ids = [...compiled.keys()];
  const order = topoSort(ids, (id) => [...(compiled.get(id)?.fields ?? [])]);
  if (!order.ok) {
    for (const id of (order.error.details as string[]) ?? []) errors[id] = order.error.message;
  }
  const sequence = order.ok ? order.value : ids.filter((id) => !errors[id]);
  for (const id of sequence) {
    const c = compiled.get(id);
    const def = defs.find((d) => d.id === id);
    if (!c || !def || errors[id]) continue;
    const missingDep = [...c.fields].find((f) => errors[f]);
    if (missingDep) {
      errors[id] = `به پارامتر نامعتبر «${missingDep}» وابسته است.`;
      continue;
    }
    ds.num[id] = evaluateNumeric(c, { ds, ...opts });
    ds.meta[id] = {
      id,
      label: def.label || id,
      category: def.category ?? 'custom',
      unit: def.unit,
      direction: def.direction,
      description: def.description ? `${def.description}\n${def.expression}` : def.expression,
      source: 'custom',
      kind: 'num',
    };
  }
  return { dataset: ds, errors };
}

function compileOne(d: CustomMetricDef, catalog: ReturnType<typeof catalogFromDataset>): Compiled | string {
  if (!d.id.startsWith(CUSTOM_PREFIX)) return `شناسه باید با ${CUSTOM_PREFIX} شروع شود.`;
  // Score fields do not exist yet when custom metrics run; give the real reason, not "not found".
  const scoreToken = new RegExp(
    `(?:^|[^A-Za-z0-9_.])((?:${SCORE_PREFIXES.map((p) => p.replace('.', '\\.')).join('|')})[A-Za-z0-9_.]+)`,
  ).exec(d.expression);
  if (scoreToken) return `پارامتر سفارشی نمی‌تواند به امتیازها وابسته باشد («${scoreToken[1]}»).`;
  const c = compile(d.expression, catalog);
  if (!c.ok) return c.error.message;
  if (c.value.type === 'text') return 'نتیجه پارامتر سفارشی باید عددی باشد.';
  if (c.value.fields.has(d.id)) return `وابستگی چرخه‌ای: ${d.id} → ${d.id}`;
  return c.value;
}
