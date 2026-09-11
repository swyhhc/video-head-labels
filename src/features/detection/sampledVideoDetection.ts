import type { Detection } from "./types";

export interface DetectionFrame {
  time: number;
  detections: Detection[];
  inferenceMs?: number;
  appearanceMs?: number;
}

export function buildSampleTimes(duration: number, intervalSeconds: number) {
  if (duration < 0) throw new Error("视频时长不能小于 0");
  if (intervalSeconds <= 0) throw new Error("检测间隔必须大于 0");
  const times: number[] = [];
  for (let time = 0; time < duration; time += intervalSeconds) {
    times.push(Number(time.toFixed(6)));
  }
  return times;
}

export function detectionsForPlaybackTime(
  frames: DetectionFrame[],
  playbackTime: number,
  intervalSeconds: number,
) {
  let nearest: DetectionFrame | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const frame of frames) {
    const candidateDistance = Math.abs(frame.time - playbackTime);
    if (candidateDistance < distance) {
      nearest = frame;
      distance = candidateDistance;
    }
  }
  return nearest && distance <= intervalSeconds / 2 ? nearest.detections : [];
}
