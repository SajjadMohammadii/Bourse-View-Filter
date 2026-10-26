import { describe, it, expect } from 'vitest';
import {
  computeCustomMetrics,
  normalizeCustomId,
  type CustomMetricDef,
} from '../../../src/core/metrics/customMetrics';
import { applyProfileEdits } from '../../../src/core/scoring/customizeProfiles';
import { profiles } from '../../../src/config/profiles';
import { up } from '../../../src/config/profiles/builders';
import { processRows } from '../../../src/app/pipeline';
import { sampleRows, SAMPLE_NAME, idx } from '../../helpers/sample';
import { miniDataset } from '../../helpers/mini';
import { compile, catalogFromDataset, runFilter, defaultConstants } from '../../../src/core/filters';

const opts = { inflation: 0.35, constants: defaultConstants(0.35, 0.3) };
const def = (id: string, expression: string): CustomMetricDef => ({
  id,
  label: id,
  expression,
  unit: 'ratio',
  direction: 'higher',
});
const ds = miniDataset([
  { NI_MRQ: 40, NI_FY: 100, DebtRatio: 0.1, TA_MRQ: 1000, Rev_MRQ: 50 },
  { NI_MRQ: 10, NI_FY: 0, DebtRatio: null, TA_MRQ: 1000, Rev_MRQ: 25 },
]);

describe('custom metrics', () => {
  it('normalizes ids with the C_ prefix', () => {
    expect(normalizeCustomId('QtrShare')).toBe('C_QtrShare');
    expect(normalizeCustomId('C_x')).toBe('C_x');
    expect(normalizeCustomId(' a-b ')).toBe('C_a_b');
  });
  it('computes expressions with null semantics', () => {
    const r = computeCustomMetrics(
      ds,
      [def('C_QtrShare', 'NI_MRQ / NI_FY'), def('C_DebtToRevQ', 'DebtRatio * TA_MRQ / (Rev_MRQ * 4)')],
      opts,
    );
    expect(r.errors).toEqual({});
    expect([...r.dataset.num['C_QtrShare']!]).toEqual([0.4, NaN]);
    expect(r.dataset.num['C_DebtToRevQ']![0]).toBe(0.5);
    expect(r.dataset.meta['C_QtrShare']?.source).toBe('custom');
  });
  it('resolves dependencies between custom metrics regardless of order', () => {
    const r = computeCustomMetrics(ds, [def('C_b', 'C_a * 2'), def('C_a', 'NI_MRQ + 1')], opts);
    expect(r.errors).toEqual({});
    expect(r.dataset.num['C_b']![0]).toBe(82);
  });
  it('detects cycles with a Persian path message and keeps independent metrics', () => {
    const r = computeCustomMetrics(
      ds,
      [def('C_a', 'C_b + 1'), def('C_b', 'C_a + 1'), def('C_ok', 'NI_MRQ')],
      opts,
    );
    expect(r.errors['C_a']).toBe('وابستگی چرخه‌ای: C_a → C_b → C_a');
    expect(r.errors['C_b']).toBeDefined();
    expect(r.dataset.num['C_ok']).toBeDefined();
    expect(computeCustomMetrics(ds, [def('C_self', 'C_self + 1')], opts).errors['C_self']).toContain('چرخه');
  });
  it('rejects score references, text results, bad ids and syntax errors', () => {
    const r = computeCustomMetrics(
      ds,
      [
        def('C_s', 'score.technical * 2'),
        def('C_t', 'if(NI_MRQ > 0, "a", "b")'),
        def('x', 'NI_MRQ'),
        def('C_e', 'NI_MRQ >'),
      ],
      opts,
    );
    expect(r.errors['C_s']).toContain('امتیاز');
    expect(r.errors['C_t']).toContain('عددی');
    expect(r.errors['x']).toContain('C_');
    expect(r.errors['C_e']).toBeDefined();
  });
  it('marks dependents of an invalid metric', () => {
    const r = computeCustomMetrics(ds, [def('C_bad', 'NOPE + 1'), def('C_dep', 'C_bad * 2')], opts);
    expect(r.errors['C_dep']).toContain('C_bad');
  });
});

describe('profile edits', () => {
  it('adds and removes factor metrics without touching other profiles', () => {
    const edited = applyProfileEdits(profiles, {
      fundamentalQuarterly: { Q1: { added: [up('C_QtrShare', 2)], removed: ['D_NI_RunRate'] } },
    });
    const q1 = edited.find((p) => p.id === 'fundamentalQuarterly')!.factors.find((f) => f.id === 'Q1')!;
    expect(q1.metrics.map((m) => m.metric)).toContain('C_QtrShare');
    expect(q1.metrics.map((m) => m.metric)).not.toContain('D_NI_RunRate');
    expect(edited[0]).toBe(profiles[0]);
  });
});

describe('phase 7 acceptance (engine level) on the sample', () => {
  const custom = [{ ...def('C_QtrShare', 'NI_MRQ / NI_FY'), label: 'سهم فصل از سود سال' }];
  const run = (withEdit: boolean) => {
    const r = processRows(sampleRows(), {
      fileName: SAMPLE_NAME,
      customMetrics: custom,
      scoring: {
        peerMode: 'default',
        stalePenalty: false,
        profileEdits: withEdit
          ? { fundamentalQuarterly: { Q1: { added: [up('C_QtrShare', 3)] } } }
          : undefined,
      },
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };
  const plain = run(false);
  const edited = run(true);

  it('the custom column exists and is filterable', () => {
    const d = plain.dataset;
    expect(plain.customErrors).toEqual({});
    const i = idx(d.symbols, 'ذوب');
    expect(d.num['C_QtrShare']![i]).toBeCloseTo(d.num['NI_MRQ']![i]! / d.num['NI_FY']![i]!);
    const c = compile('C_QtrShare > 0.35', catalogFromDataset(d, opts.constants));
    expect(c.ok).toBe(true);
    if (c.ok) expect(runFilter(c.value, { ds: d, ...opts }).reduce((a, b) => a + b, 0)).toBeGreaterThan(10);
  });

  it('adding it to Q1 changes quarterly scores', () => {
    const a = plain.dataset.num['factor.fundamentalQuarterly.Q1']!;
    const b = edited.dataset.num['factor.fundamentalQuarterly.Q1']!;
    let changed = 0;
    for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i]!) && a[i] !== b[i]) changed++;
    expect(changed).toBeGreaterThan(100);
  });
});
