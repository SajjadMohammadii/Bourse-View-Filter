import { describe, it, expect } from 'vitest';
import { loadSample, sampleRows, idx } from '../helpers/sample';
import { normalizeHeader } from '../../src/core/data/normalizeHeaders';
import { columnDictionary } from '../../src/config/columns';

describe('sample file (phase 1 acceptance)', () => {
  const { dataset, report } = loadSample();

  it('loads 957 symbols', () => {
    expect(dataset.size).toBe(957);
    expect(new Set(dataset.symbols).size).toBe(957);
  });

  it('normalizes headers with newlines', () => {
    expect(dataset.num['OP_Margin_TTM_3yGR_Arith']).toBeDefined();
    expect(dataset.num['GP_Margin_TTM_1yGR']).toBeDefined();
  });

  it('maps "-" to null and keeps real values', () => {
    const i = idx(dataset.symbols, 'ذوب');
    expect(Number.isNaN(dataset.num['EBIT']?.[i] ?? 0)).toBe(true);
    expect(dataset.num['MarketCap']?.[i]).toBe(370899018602036);
    expect(dataset.text['Industry']?.[i]).toBe('آهن و فولاد');
  });

  it('registers every sample column in the data dictionary', () => {
    const headers = (sampleRows()[0] ?? []).map(normalizeHeader).filter(Boolean);
    const missing = headers.filter((h) => !columnDictionary.has(h));
    expect(missing).toEqual([]);
    expect(report.unknownColumns).toEqual([]);
  });

  it('has no missing dictionary columns, no duplicates and the 2 unknown-sector symbols', () => {
    expect(report.missingColumns).toEqual([]);
    expect(report.duplicateSymbols).toEqual([]);
    expect(report.noSectorSymbols).toHaveLength(2);
  });

  it('stores FiscalYear as a number with "----" as null', () => {
    const fy = dataset.num['FiscalYear'];
    expect(fy).toBeDefined();
    expect([...(fy ?? [])].filter(Number.isNaN)).toHaveLength(7);
  });
});
