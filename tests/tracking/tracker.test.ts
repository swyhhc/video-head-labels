import { describe, expect, it } from "vitest";

import { observationsForPlaybackTime, trackDetectionFrames } from "../../src/features/tracking/tracker";
import type { DetectionFrame } from "../../src/features/detection/sampledVideoDetection";

function frame(time: number, detections: Array<{ id: string; x: number; y?: number; category?: string }>): DetectionFrame {
  return {
    time,
    detections: detections.map(({ id, x, y = 0, category = "person" }) => ({
      detectionId: id,
      classId: category === "person" ? 0 : 14,
      category,
      confidence: 0.8,
      box: { x, y, width: 20, height: 20 },
    })),
  };
}

function appearanceFrame(time: number, detections: Array<{ id: string; x: number; appearance?: number[]; category?: string }>): DetectionFrame {
  return {
    time,
    detections: detections.map(({ id, x, appearance, category = "person" }) => ({
      detectionId: id,
      classId: category === "person" ? 0 : 14,
      category,
      confidence: 0.8,
      box: { x, y: 0, width: 20, height: 20 },
      appearance,
    })),
  };
}

describe("trackDetectionFrames", () => {
  it("keeps one moving subject on one stable identity", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "a0", x: 0 }]),
      frame(0.5, [{ id: "a1", x: 8 }]),
      frame(1, [{ id: "a2", x: 16 }]),
    ]);

    expect(result.frames.map((item) => item.observations[0].trackId)).toEqual([
      "track_001", "track_001", "track_001",
    ]);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].lifecycle).toBe("active");
  });

  it("distinguishes two subjects of the same category", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "left", x: 0 }, { id: "right", x: 80 }]),
      frame(0.5, [{ id: "left-2", x: 5 }, { id: "right-2", x: 75 }]),
    ]);

    expect(result.frames[1].observations.map((item) => item.trackId)).toEqual([
      "track_001", "track_002",
    ]);
  });

  it("uses motion prediction to preserve identities while subjects cross", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "a0", x: 0 }, { id: "b0", x: 80 }]),
      frame(0.5, [{ id: "a1", x: 25 }, { id: "b1", x: 55 }]),
      frame(1, [{ id: "b2", x: 30 }, { id: "a2", x: 50 }]),
    ]);

    expect(result.frames[2].observations.map((item) => [item.detectionId, item.trackId])).toEqual([
      ["b2", "track_002"],
      ["a2", "track_001"],
    ]);
  });

  it("restores the same identity after a short configured miss", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "a0", x: 0 }]),
      frame(0.5, []),
      frame(1, []),
      frame(1.5, [{ id: "a3", x: 12 }]),
    ], { lostWindowFrames: 2 });

    expect(result.frames[3].observations[0].trackId).toBe("track_001");
    expect(result.tracks[0].lifecycle).toBe("active");
  });

  it("ends a subject after the lost window and gives a later entrant a new identity", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "a0", x: 0 }]),
      frame(0.5, []),
      frame(1, []),
      frame(1.5, []),
      frame(2, [{ id: "new", x: 2 }]),
    ], { lostWindowFrames: 2 });

    expect(result.tracks.map((track) => [track.trackId, track.lifecycle])).toEqual([
      ["track_001", "ended"],
      ["track_002", "new"],
    ]);
    expect(result.frames[4].observations[0].trackId).toBe("track_002");
  });

  it("never associates detections from different categories", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "person", x: 10, category: "person" }]),
      frame(0.5, [{ id: "bird", x: 10, category: "bird" }]),
    ]);

    expect(result.tracks.map((track) => track.trackId)).toEqual(["track_001", "track_002"]);
  });

  it("globally matches detector output beyond 32 candidates without identity collisions", () => {
    const crowded = Array.from({ length: 33 }, (_, index) => ({
      id: `candidate-${index}`,
      x: index === 0 ? 2 : index === 32 ? 102 : 500 + index * 30,
    }));
    const result = trackDetectionFrames([
      frame(0, [{ id: "left", x: 0 }, { id: "right", x: 100 }]),
      frame(0.5, crowded),
    ]);

    expect(result.frames[1].observations.slice(0, 33).filter((item) => item.trackId === "track_001")).toEqual([
      expect.objectContaining({ detectionId: "candidate-0" }),
    ]);
    expect(result.frames[1].observations.slice(0, 33).filter((item) => item.trackId === "track_002")).toEqual([
      expect.objectContaining({ detectionId: "candidate-32" }),
    ]);
  });

  it("returns only the tracked observations nearest to the current time", () => {
    const result = trackDetectionFrames([
      frame(0, [{ id: "a0", x: 0 }]),
      frame(0.5, [{ id: "a1", x: 5 }]),
    ]);

    expect(observationsForPlaybackTime(result.frames, 0.48, 0.5)[0].detectionId).toBe("a1");
    expect(observationsForPlaybackTime(result.frames, 1.2, 0.5)).toEqual([]);
  });

  it.each(["person", "bird"])("uses appearance to prevent a %s identity switch when subjects reverse near each other", (category) => {
    const frames = [
      appearanceFrame(0, [{ id: "red-0", x: 0, appearance: [1, 0], category }, { id: "blue-0", x: 60, appearance: [0, 1], category }]),
      appearanceFrame(0.5, [{ id: "red-1", x: 20, appearance: [1, 0], category }, { id: "blue-1", x: 40, appearance: [0, 1], category }]),
      appearanceFrame(1, [{ id: "red-2", x: 22, appearance: [1, 0], category }, { id: "blue-2", x: 38, appearance: [0, 1], category }]),
    ];

    const before = trackDetectionFrames(frames, { appearanceWeight: 0 });
    const after = trackDetectionFrames(frames, { appearanceWeight: 0.45 });

    expect(before.frames[2].observations.map((item) => item.trackId)).toEqual(["track_002", "track_001"]);
    expect(after.frames[2].observations.map((item) => item.trackId)).toEqual(["track_001", "track_002"]);
  });

  it("uses track appearance history after two missed samples", () => {
    const frames = [
      appearanceFrame(0, [{ id: "red-0", x: 0, appearance: [1, 0] }, { id: "blue-0", x: 40, appearance: [0, 1] }]),
      appearanceFrame(0.5, []),
      appearanceFrame(1, []),
      appearanceFrame(1.5, [{ id: "blue-3", x: 5, appearance: [0, 1] }, { id: "red-3", x: 35, appearance: [1, 0] }]),
    ];
    const before = trackDetectionFrames(frames, { appearanceWeight: 0 });
    const after = trackDetectionFrames(frames);

    expect(before.frames[3].observations.map((item) => item.trackId)).toEqual(["track_001", "track_002"]);
    expect(after.frames[3].observations.map((item) => item.trackId)).toEqual(["track_002", "track_001"]);
  });

  it("rejects a spatially impossible match even when appearance is identical", () => {
    const result = trackDetectionFrames([
      appearanceFrame(0, [{ id: "a0", x: 0, appearance: [1, 0] }]),
      appearanceFrame(0.5, [{ id: "far", x: 500, appearance: [1, 0] }]),
    ]);

    expect(result.frames[1].observations[0].trackId).toBe("track_002");
  });

  it("preserves motion-only behavior when appearance is unavailable", () => {
    const frames = [
      frame(0, [{ id: "a0", x: 0 }]),
      frame(0.5, [{ id: "a1", x: 8 }]),
    ];

    expect(trackDetectionFrames(frames).frames).toEqual(
      trackDetectionFrames(frames, { appearanceWeight: 0 }).frames,
    );
  });
});
