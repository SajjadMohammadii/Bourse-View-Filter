import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readWorkbook } from '../../src/app/io/readWorkbook';
import { processRows, type PipelineResult } from '../../src/app/pipeline';

export const SAMPLE_PATH = resolve('data/samples/screener-plus-1405-08-04.xlsx');
export const SAMPLE_NAME = 'screener-plus-1405-08-04.xlsx';

let rowsCache: unknown[][] | null = null;

export function sampleRows(): unknown[][] {
  if (rowsCache) return rowsCache;
  const buf = readFileSync(SAMPLE_PATH);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const rows = readWorkbook(ab);
  if (!rows.ok) throw new Error(rows.error.message);
  rowsCache = rows.value;
  return rowsCache;
}

export function loadSample(): PipelineResult {
  const r = processRows(sampleRows(), { fileName: SAMPLE_NAME });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Index of a symbol in a dataset; throws when missing. */
export function idx(symbols: string[], symbol: string): number {
  const i = symbols.indexOf(symbol);
  if (i < 0) throw new Error(`symbol ${symbol} not found`);
  return i;
}
