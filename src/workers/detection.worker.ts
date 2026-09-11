/// <reference lib="webworker" />

import * as ort from "onnxruntime-web/webgpu";

import { calculateLetterbox, decodeYoloOutput, videoBoxToLetterbox, YOLO_MODEL } from "../features/detection/browserDetector";
import type { DetectionBackend, MemoryObservation } from "../features/detection/types";
import type { DetectionWorkerRequest, DetectionWorkerResponse } from "../features/detection/workerProtocol";
import { extractAppearance } from "../features/tracking/appearance";
import { TRACKER_CONFIG } from "../features/tracking/config";

let session: ort.InferenceSession | null = null;
let backend: DetectionBackend | null = null;

self.addEventListener("message", async (event: MessageEvent<DetectionWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "initialize") {
      const memoryBefore = observeMemory();
      const downloadStart = performance.now();
      const response = await fetch(YOLO_MODEL.url);
      if (!response.ok) throw new Error(`模型加载失败：HTTP ${response.status}`);
      const model = await response.arrayBuffer();
      const modelDownloadMs = performance.now() - downloadStart;
      if (model.byteLength !== YOLO_MODEL.bytes) throw new Error("模型大小校验失败");

      const initializationStart = performance.now();
      const candidates: DetectionBackend[] = request.preference === "auto" ? ["webgpu", "wasm"] : [request.preference];
      let lastError: unknown;
      for (const candidate of candidates) {
        try {
          session = await ort.InferenceSession.create(model, { executionProviders: [candidate], graphOptimizationLevel: "all" });
          backend = candidate;
          post({
            type: "initialized",
            requestId: request.requestId,
            metrics: {
              backend: candidate,
              modelBytes: model.byteLength,
              modelDownloadMs,
              initializationMs: performance.now() - initializationStart,
              memoryBefore,
              memoryAfter: observeMemory(),
            },
          });
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(`Worker 内 WebGPU 与 WASM 均无法初始化：${messageFor(lastError)}`);
    }

    if (!session) throw new Error("Worker 模型尚未初始化");
    const { bitmap, originalWidth, originalHeight } = request;
    const transform = calculateLetterbox(originalWidth, originalHeight);
    const canvas = new OffscreenCanvas(transform.inputSize, transform.inputSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Worker 无法创建离屏画布");
    context.fillStyle = "rgb(114, 114, 114)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, transform.padX, transform.padY, transform.scaledWidth, transform.scaledHeight);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const planeSize = canvas.width * canvas.height;
    const chw = new Float32Array(planeSize * 3);
    for (let pixel = 0; pixel < planeSize; pixel += 1) {
      const rgba = pixel * 4;
      chw[pixel] = pixels[rgba] / 255;
      chw[planeSize + pixel] = pixels[rgba + 1] / 255;
      chw[planeSize * 2 + pixel] = pixels[rgba + 2] / 255;
    }
    const start = performance.now();
    const output = await session.run({ images: new ort.Tensor("float32", chw, [1, 3, canvas.height, canvas.width]) });
    const inferenceMs = performance.now() - start;
    const tensor = output.output0;
    if (!(tensor.data instanceof Float32Array)) throw new Error("模型输出不是 Float32Array");
    const decoded = decodeYoloOutput(tensor.data, tensor.dims, transform);
    const appearanceStart = performance.now();
    const detections = decoded.map((detection, index) => ({
      ...detection,
      detectionId: `sample-${request.sampleIndex}-${detection.detectionId}`,
      appearance: index < TRACKER_CONFIG.maxTracks
        ? extractAppearance(pixels, canvas.width, canvas.height, videoBoxToLetterbox(detection.box, transform)) ?? undefined
        : undefined,
    }));
    const appearanceMs = performance.now() - appearanceStart;
    let maxConfidence = 0;
    for (let channel = 4; channel < 84; channel += 1) {
      for (let candidate = 0; candidate < (tensor.dims.at(-1) ?? 0); candidate += 1) {
        maxConfidence = Math.max(maxConfidence, tensor.data[channel * (tensor.dims.at(-1) ?? 0) + candidate]);
      }
    }
    post({ type: "detected", requestId: request.requestId, detections, inferenceMs, appearanceMs, maxConfidence });
  } catch (error) {
    post({ type: "failed", requestId: request.requestId, message: messageFor(error), backend });
  }
});

function post(response: DetectionWorkerResponse) {
  self.postMessage(response);
}

function observeMemory(): MemoryObservation {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? { available: true, usedJSHeapBytes: memory.usedJSHeapSize } : { available: false };
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
