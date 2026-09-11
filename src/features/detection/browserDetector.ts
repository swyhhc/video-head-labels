import * as ort from "onnxruntime-web/webgpu";

import { DETECTION_CONFIG } from "./config";
import type {
  BackendPreference,
  Detection,
  DetectionBackend,
  Detector,
  DetectorLoadMetrics,
  DetectorRunResult,
  MemoryObservation,
} from "./types";

export const YOLO_MODEL = {
  url: "/models/yolov8n.onnx",
  bytes: 12_822_144,
  inputSize: DETECTION_CONFIG.inputSize,
  sha256: "e2334296256ef5b5914c5fd05f5c4ba7dfac823c3b019d578e95e03855e19fa7",
} as const;

export interface LetterboxTransform {
  inputSize: number;
  scaledWidth: number;
  scaledHeight: number;
  padX: number;
  padY: number;
  scale: number;
}

const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
  "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
  "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
  "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
  "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
  "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
] as const;

export function calculateLetterbox(
  width: number,
  height: number,
  inputSize = YOLO_MODEL.inputSize,
): LetterboxTransform {
  if (width <= 0 || height <= 0) throw new Error("检测画面尺寸必须大于 0");
  const scale = Math.min(inputSize / width, inputSize / height);
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);
  return {
    inputSize,
    scaledWidth,
    scaledHeight,
    padX: (inputSize - scaledWidth) / 2,
    padY: (inputSize - scaledHeight) / 2,
    scale,
  };
}

export function decodeYoloOutput(
  data: Float32Array,
  dims: readonly number[],
  transform: LetterboxTransform,
): Detection[] {
  const channels = dims.at(-2);
  const candidates = dims.at(-1);
  if (channels !== 84 || !candidates || data.length !== channels * candidates) {
    throw new Error(`无法识别模型输出形状：${dims.join(" × ")}`);
  }

  const proposals: Detection[] = [];
  for (let candidate = 0; candidate < candidates; candidate += 1) {
    let classId = 0;
    let confidence = 0;
    for (let classIndex = 0; classIndex < COCO_CLASSES.length; classIndex += 1) {
      const score = data[(classIndex + 4) * candidates + candidate];
      if (score > confidence) {
        confidence = score;
        classId = classIndex;
      }
    }
    if (confidence < DETECTION_CONFIG.scoreThreshold) continue;

    const centerX = data[candidate];
    const centerY = data[candidates + candidate];
    const width = data[2 * candidates + candidate];
    const height = data[3 * candidates + candidate];
    const x = clamp((centerX - width / 2 - transform.padX) / transform.scale, 0, transform.scaledWidth / transform.scale);
    const y = clamp((centerY - height / 2 - transform.padY) / transform.scale, 0, transform.scaledHeight / transform.scale);
    const right = clamp((centerX + width / 2 - transform.padX) / transform.scale, 0, transform.scaledWidth / transform.scale);
    const bottom = clamp((centerY + height / 2 - transform.padY) / transform.scale, 0, transform.scaledHeight / transform.scale);
    if (right <= x || bottom <= y) continue;

    proposals.push({
      detectionId: `frame-detection-${candidate}`,
      classId,
      category: COCO_CLASSES[classId],
      confidence,
      box: { x, y, width: right - x, height: bottom - y },
    });
  }

  return nonMaximumSuppression(proposals, DETECTION_CONFIG.iouThreshold).slice(0, DETECTION_CONFIG.maxDetectionsPerFrame);
}

export class BrowserDetector implements Detector {
  backend: DetectionBackend | null = null;
  private session: ort.InferenceSession | null = null;
  private modelBytes: ArrayBuffer | null = null;

  async initialize(preference: BackendPreference = "auto"): Promise<DetectorLoadMetrics> {
    await this.dispose();
    const memoryBefore = observeMemory();
    const downloadStart = performance.now();
    const response = await fetch(YOLO_MODEL.url);
    if (!response.ok) throw new Error(`模型加载失败：HTTP ${response.status}`);
    this.modelBytes = await response.arrayBuffer();
    const modelDownloadMs = performance.now() - downloadStart;
    if (this.modelBytes.byteLength !== YOLO_MODEL.bytes) {
      throw new Error(`模型大小校验失败：应为 ${YOLO_MODEL.bytes} 字节，实际为 ${this.modelBytes.byteLength} 字节`);
    }

    const initializationStart = performance.now();
    const candidates: DetectionBackend[] = preference === "auto" ? ["webgpu", "wasm"] : [preference];
    let lastError: unknown;
    for (const backend of candidates) {
      try {
        this.session = await ort.InferenceSession.create(this.modelBytes, {
          executionProviders: [backend],
          graphOptimizationLevel: "all",
        });
        this.backend = backend;
        return {
          backend,
          modelBytes: this.modelBytes.byteLength,
          modelDownloadMs,
          initializationMs: performance.now() - initializationStart,
          memoryBefore,
          memoryAfter: observeMemory(),
        };
      } catch (error) {
        lastError = error;
      }
    }
    this.modelBytes = null;
    throw new Error(`WebGPU 与 WASM 均无法初始化模型：${errorMessage(lastError)}`);
  }

  async detect(
    source: CanvasImageSource,
    originalWidth: number,
    originalHeight: number,
  ): Promise<DetectorRunResult> {
    if (!this.session) throw new Error("模型尚未初始化");
    const { tensor, transform } = imageToTensor(source, originalWidth, originalHeight);
    const start = performance.now();
    const output = await this.session.run({ images: tensor });
    const inferenceMs = performance.now() - start;
    const result = output.output0;
    if (!(result.data instanceof Float32Array)) throw new Error("模型输出不是 Float32Array");
    return {
      detections: decodeYoloOutput(result.data, result.dims, transform),
      inferenceMs,
      maxConfidence: maxClassConfidence(result.data, result.dims),
    };
  }

  async dispose() {
    await this.session?.release();
    this.session = null;
    this.modelBytes = null;
    this.backend = null;
  }
}

function imageToTensor(
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  const transform = calculateLetterbox(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = transform.inputSize;
  canvas.height = transform.inputSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("浏览器无法创建检测画布");
  context.fillStyle = "rgb(114, 114, 114)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, transform.padX, transform.padY, transform.scaledWidth, transform.scaledHeight);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const planeSize = canvas.width * canvas.height;
  const chw = new Float32Array(planeSize * 3);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    const rgba = pixel * 4;
    chw[pixel] = pixels[rgba] / 255;
    chw[planeSize + pixel] = pixels[rgba + 1] / 255;
    chw[planeSize * 2 + pixel] = pixels[rgba + 2] / 255;
  }
  return {
    tensor: new ort.Tensor("float32", chw, [1, 3, canvas.height, canvas.width]),
    transform,
  };
}

function nonMaximumSuppression(detections: Detection[], threshold: number) {
  const remaining = [...detections].sort((a, b) => b.confidence - a.confidence);
  const selected: Detection[] = [];
  while (remaining.length > 0) {
    const best = remaining.shift();
    if (!best) break;
    selected.push(best);
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (remaining[index].classId === best.classId && intersectionOverUnion(best, remaining[index]) > threshold) {
        remaining.splice(index, 1);
      }
    }
  }
  return selected;
}

function maxClassConfidence(data: Float32Array, dims: readonly number[]) {
  const candidates = dims.at(-1) ?? 0;
  let maximum = 0;
  for (let channel = 4; channel < 84; channel += 1) {
    for (let candidate = 0; candidate < candidates; candidate += 1) {
      maximum = Math.max(maximum, data[channel * candidates + candidate]);
    }
  }
  return maximum;
}

function intersectionOverUnion(a: Detection, b: Detection) {
  const left = Math.max(a.box.x, b.box.x);
  const top = Math.max(a.box.y, b.box.y);
  const right = Math.min(a.box.x + a.box.width, b.box.x + b.box.width);
  const bottom = Math.min(a.box.y + a.box.height, b.box.y + b.box.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.box.width * a.box.height + b.box.width * b.box.height - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function observeMemory(): MemoryObservation {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number };
  }).memory;
  return memory
    ? { available: true, usedJSHeapBytes: memory.usedJSHeapSize }
    : { available: false };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
