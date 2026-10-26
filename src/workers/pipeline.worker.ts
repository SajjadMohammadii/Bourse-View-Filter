import { PipelineSession } from '../app/pipelineSession';
import { transferables, type WorkerRequest, type WorkerResponse } from '../app/workerProtocol';

interface WorkerScope {
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
const session = new PipelineSession();

scope.onmessage = (ev) => {
  const msg = ev.data;
  const result = msg.type === 'load' ? session.load(msg.payload) : session.rescore(msg.payload);
  scope.postMessage({ id: msg.id, result }, transferables(result));
};
