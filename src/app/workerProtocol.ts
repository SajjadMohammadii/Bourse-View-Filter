import type { Result } from '../core/types';
import type { LoadRequest, PipelineOptions, PipelineResult } from './pipeline';

export type WorkerRequest =
  | { id: number; type: 'load'; payload: LoadRequest }
  | { id: number; type: 'rescore'; payload: PipelineOptions };

export type WorkerResponse = { id: number; result: Result<PipelineResult> };

/** Buffers to transfer (zero-copy) when posting a result back. */
export function transferables(result: Result<PipelineResult>): ArrayBuffer[] {
  if (!result.ok) return [];
  return Object.values(result.value.dataset.num).map((a) => a.buffer as ArrayBuffer);
}
