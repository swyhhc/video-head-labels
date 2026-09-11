import type { BackendPreference, DetectorLoadMetrics, DetectorRunResult } from "./types";
import type { DetectionWorkerRequest, DetectionWorkerResponse } from "./workerProtocol";

type PendingRequest = {
  resolve(value: unknown): void;
  reject(reason: Error): void;
};

type WithoutRequestId<T> = T extends { requestId: number } ? Omit<T, "requestId"> : never;
type DetectionWorkerRequestInput = WithoutRequestId<DetectionWorkerRequest>;

export class DetectionWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;

  constructor() {
    this.worker = new Worker(new URL("../../workers/detection.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", this.onMessage);
    this.worker.addEventListener("error", this.onWorkerError);
  }

  initialize(preference: BackendPreference = "auto") {
    return this.request<DetectorLoadMetrics>({ type: "initialize", preference });
  }

  detect(bitmap: ImageBitmap, originalWidth: number, originalHeight: number, sampleIndex: number) {
    return this.request<DetectorRunResult>({ type: "detect", bitmap, originalWidth, originalHeight, sampleIndex }, [bitmap]);
  }

  dispose() {
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.removeEventListener("error", this.onWorkerError);
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(new Error("检测 Worker 已关闭"));
    this.pending.clear();
  }

  private request<T>(request: DetectionWorkerRequestInput, transfer: Transferable[] = []) {
    const requestId = this.nextRequestId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ ...request, requestId } as DetectionWorkerRequest, transfer);
    });
  }

  private onMessage = (event: MessageEvent<DetectionWorkerResponse>) => {
    const response = event.data;
    const request = this.pending.get(response.requestId);
    if (!request) return;
    this.pending.delete(response.requestId);
    if (response.type === "failed") {
      request.reject(new Error(response.message));
    } else if (response.type === "initialized") {
      request.resolve(response.metrics);
    } else {
      request.resolve({ detections: response.detections, inferenceMs: response.inferenceMs, appearanceMs: response.appearanceMs, maxConfidence: response.maxConfidence });
    }
  };

  private onWorkerError = (event: ErrorEvent) => {
    const error = new Error(event.message || "检测 Worker 运行失败");
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  };
}
