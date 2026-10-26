import type { Result } from '../core/types';
import type { LoadRequest, PipelineOptions, PipelineResult } from './pipeline';
import { PipelineSession } from './pipelineSession';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';
import PipelineWorker from '../workers/pipeline.worker.ts?worker&inline';

type Job = { type: 'load'; payload: LoadRequest } | { type: 'rescore'; payload: PipelineOptions };

/** Runs the pipeline in a Web Worker; falls back to the main thread if the worker is unavailable or dies. */
export class PipelineClient {
  private worker: Worker | null = null;
  private fallback: PipelineSession | null = null;
  private lastLoad: LoadRequest | null = null;
  private seq = 0;
  private readonly pending = new Map<number, { job: Job; resolve: (r: Result<PipelineResult>) => void }>();

  constructor() {
    try {
      this.worker = new PipelineWorker();
      this.worker.onmessage = (ev: MessageEvent<WorkerResponse>) => this.settle(ev.data.id, ev.data.result);
      this.worker.onerror = () => this.fallBackToMainThread();
    } catch {
      this.worker = null;
    }
  }

  load(payload: LoadRequest): Promise<Result<PipelineResult>> {
    this.lastLoad = payload;
    return this.run({ type: 'load', payload });
  }

  rescore(payload: PipelineOptions): Promise<Result<PipelineResult>> {
    return this.run({ type: 'rescore', payload });
  }

  private run(job: Job): Promise<Result<PipelineResult>> {
    if (!this.worker) return Promise.resolve(this.runLocal(job));
    const id = ++this.seq;
    // Input buffers are copied (not transferred) so the main thread can retry on failure.
    const msg = { id, ...job } as WorkerRequest;
    return new Promise((resolve) => {
      this.pending.set(id, { job, resolve });
      this.worker?.postMessage(msg);
    });
  }

  private runLocal(job: Job): Result<PipelineResult> {
    if (!this.fallback) {
      this.fallback = new PipelineSession();
      if (job.type === 'rescore' && this.lastLoad) this.fallback.load(this.lastLoad);
    }
    return job.type === 'load' ? this.fallback.load(job.payload) : this.fallback.rescore(job.payload);
  }

  private settle(id: number, result: Result<PipelineResult>): void {
    this.pending.get(id)?.resolve(result);
    this.pending.delete(id);
  }

  private fallBackToMainThread(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [id, { job }] of this.pending) this.settle(id, this.runLocal(job));
  }
}
