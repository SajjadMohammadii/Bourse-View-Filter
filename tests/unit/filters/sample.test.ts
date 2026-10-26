import { describe, it, expect } from 'vitest';
import { loadSample } from '../../helpers/sample';
import { compile, catalogFromDataset, runFilter, defaultConstants } from '../../../src/core/filters';
import { filterPresets } from '../../../src/config/filterPresets';

describe('phase 5 acceptance on the sample file', () => {
  const { dataset: ds } = loadSample();
  const constants = defaultConstants(0.35, 0.3);
  const catalog = catalogFromDataset(ds, constants);
  const ctx = { ds, inflation: 0.35, constants };

  it('evaluates the acceptance expression correctly', () => {
    const c = compile(
      'NI_MRQ / NI_FY > 35% AND Exchange IN ("TSE","IFB") AND score.technical >= 60',
      catalog,
    );
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const mask = runFilter(c.value, ctx);
    const nm = ds.num['NI_MRQ']!,
      nf = ds.num['NI_FY']!,
      st = ds.num['score.technical']!,
      ex = ds.text['Exchange']!;
    let expected = 0;
    for (let i = 0; i < ds.size; i++) {
      const ratio = nf[i] === 0 ? NaN : nm[i]! / nf[i]!;
      const want = ratio > 0.35 && (ex[i] === 'TSE' || ex[i] === 'IFB') && st[i]! >= 60;
      expect(mask[i]).toBe(want ? 1 : 0);
      expected += want ? 1 : 0;
    }
    expect(expected).toBeGreaterThan(0);
  });

  it('evaluates 1000 symbols in under 20 ms', () => {
    const c = compile(
      'NI_MRQ / NI_FY > 35% AND Exchange IN ("TSE","IFB") AND score.technical >= 60',
      catalog,
    );
    if (!c.ok) throw new Error(c.error.message);
    runFilter(c.value, ctx);
    const t0 = performance.now();
    for (let k = 0; k < 10; k++) runFilter(c.value, ctx);
    expect((performance.now() - t0) / 10).toBeLessThan(20);
  });

  it('every built-in preset compiles and runs on the sample', () => {
    for (const p of filterPresets) {
      const c = compile(p.expression, catalog);
      expect(c.ok, `${p.id}: ${c.ok ? '' : c.error.message}`).toBe(true);
      if (c.ok) expect(runFilter(c.value, ctx).length).toBe(ds.size);
    }
  });
});
