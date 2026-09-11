export const DETECTION_CONFIG = {
  inputSize: 640,
  scoreThreshold: 0.15,
  iouThreshold: 0.45,
  maxDetectionsPerFrame: 100,
  sampleIntervalSeconds: 0.5,
} as const;
