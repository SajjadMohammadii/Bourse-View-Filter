import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import {
  processRows,
  runLoadPipeline,
  type LoadRequest,
  type PipelineOptions,
  type PipelineResult,
} from './pipeline';

/**
 * Keeps the rows of the last loaded file so options changes only re-run steps 2–8.
 * Used inside the worker and, as a fallback, on the main thread.
 */
export class PipelineSession {
  private last: { rows: unknown[][]; fileName: string; snapshotDate?: LoadRequest['snapshotDate'] } | null =
    null;

  load(req: LoadRequest): Result<PipelineResult> {
    const r = runLoadPipeline(req);
    if (!r.ok) return r;
    const { rows, ...result } = r.value;
    this.last = { rows, fileName: req.fileName, snapshotDate: req.snapshotDate };
    return ok(result);
  }

  rescore(options: PipelineOptions): Result<PipelineResult> {
    if (!this.last) return err('NO_FILE', 'ابتدا یک فایل بارگذاری کنید.');
    return processRows(this.last.rows, {
      ...options,
      fileName: this.last.fileName,
      snapshotDate: this.last.snapshotDate,
    });
  }
}
