import { describe, expect, it } from "vitest";

import {
  buildSampleTimes,
  detectionsForPlaybackTime,
} from "../../src/features/detection/sampledVideoDetection";

describe("sampled video detection", () => {
  it("builds sample times from one configured interval", () => {
    expect(buildSampleTimes(1.1, 0.5)).toEqual([0, 0.5, 1]);
    expect(() => buildSampleTimes(1, 0)).toThrow("检测间隔必须大于 0");
  });

  it("uses only the nearest real sampled result during playback", () => {
    const frames = [
      { time: 0, detections: [] },
      {
        time: 0.5,
        detections: [{
          detectionId: "sample-1-detection-0",
          classId: 0,
          category: "person",
          confidence: 0.8,
          box: { x: 100, y: 50, width: 200, height: 400 },
        }],
      },
    ];

    expect(detectionsForPlaybackTime(frames, 0.48, 0.5)).toEqual(frames[1].detections);
    expect(detectionsForPlaybackTime(frames, 1.2, 0.5)).toEqual([]);
  });

  it("keeps adjacent samples independent instead of assigning Track IDs", () => {
    const frames = [
      { time: 0, detections: [{ detectionId: "sample-0-detection-0", classId: 0, category: "person", confidence: 0.8, box: { x: 0, y: 0, width: 10, height: 10 } }] },
      { time: 0.5, detections: [{ detectionId: "sample-1-detection-0", classId: 0, category: "person", confidence: 0.8, box: { x: 1, y: 0, width: 10, height: 10 } }] },
    ];

    expect(frames[0].detections[0].detectionId).not.toBe(frames[1].detections[0].detectionId);
  });
});
