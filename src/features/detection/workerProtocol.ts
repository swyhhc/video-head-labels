import type { BackendPreference, Detection, DetectionBackend, DetectorLoadMetrics } from "./types";

export type DetectionWorkerRequest =
  | { type: "initialize"; requestId: number; preference: BackendPreference }
  | { type: "detect"; requestId: number; bitmap: ImageBitmap; originalWidth: number; originalHeight: number; sampleIndex: number };

export type DetectionWorkerResponse =
  | { type: "initialized"; requestId: number; metrics: DetectorLoadMetrics }
  | { type: "detected"; requestId: number; detections: Detection[]; inferenceMs: number; appearanceMs: number; maxConfidence: number }
  | { type: "failed"; requestId: number; message: string; backend: DetectionBackend | null };
