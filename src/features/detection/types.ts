export type DetectionBackend = "webgpu" | "wasm";
export type BackendPreference = "auto" | DetectionBackend;

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  /** Per-frame render key only. It is never a Track ID. */
  detectionId: string;
  classId: number;
  category: string;
  confidence: number;
  /** Coordinates in the original video pixel space. */
  box: DetectionBox;
  /** Optional lightweight appearance descriptor produced locally for tracking. */
  appearance?: readonly number[];
}

export interface MemoryObservation {
  available: boolean;
  usedJSHeapBytes?: number;
}

export interface DetectorLoadMetrics {
  backend: DetectionBackend;
  modelBytes: number;
  modelDownloadMs: number;
  initializationMs: number;
  memoryBefore: MemoryObservation;
  memoryAfter: MemoryObservation;
}

export interface DetectorRunResult {
  detections: Detection[];
  inferenceMs: number;
  appearanceMs?: number;
  maxConfidence: number;
}

export interface Detector {
  readonly backend: DetectionBackend | null;
  initialize(preference?: BackendPreference): Promise<DetectorLoadMetrics>;
  detect(
    source: CanvasImageSource,
    originalWidth: number,
    originalHeight: number,
  ): Promise<DetectorRunResult>;
  dispose(): Promise<void>;
}
