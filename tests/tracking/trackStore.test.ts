import { describe, expect, it } from "vitest";

import {
  applyUserTrackSettings,
  createUserTrackSettings,
  updateUserTrackSettings,
} from "../../src/features/tracking/trackStore";
import type { Track, TrackedObservation } from "../../src/features/tracking/types";

const tracks: Track[] = [
  { trackId: "track_001", category: "bird", confidence: 0.8, lifecycle: "active", positions: [] },
  { trackId: "track_002", category: "bird", confidence: 0.7, lifecycle: "active", positions: [] },
];

const observations: TrackedObservation[] = [{
  trackId: "track_001",
  lifecycle: "active",
  detectionId: "d1",
  classId: 14,
  category: "bird",
  confidence: 0.8,
  box: { x: 10, y: 20, width: 30, height: 40 },
}];

describe("user track settings", () => {
  it("creates distinct natural default names without changing AI categories", () => {
    const settings = createUserTrackSettings(tracks, {});

    expect(settings.track_001.labelZh).toBe("鸟 1");
    expect(settings.track_002.labelZh).toBe("鸟 2");
    expect(tracks.map((track) => track.category)).toEqual(["bird", "bird"]);
  });

  it("uses edited names immediately while retaining the AI category", () => {
    let settings = createUserTrackSettings(tracks, {});
    settings = updateUserTrackSettings(settings, "track_001", { labelZh: "小胖", labelEn: "Puffy" });

    expect(applyUserTrackSettings(observations, settings)).toEqual([expect.objectContaining({
      trackId: "track_001",
      category: "bird",
      labelZh: "小胖",
      labelEn: "Puffy",
    })]);
  });

  it("hides, restores, and deletes a subject independently", () => {
    let settings = createUserTrackSettings(tracks, {});
    settings = updateUserTrackSettings(settings, "track_001", { visible: false });
    expect(applyUserTrackSettings(observations, settings)).toEqual([]);

    settings = updateUserTrackSettings(settings, "track_001", { visible: true });
    expect(applyUserTrackSettings(observations, settings)).toHaveLength(1);

    settings = updateUserTrackSettings(settings, "track_001", { deleted: true });
    expect(applyUserTrackSettings(observations, settings)).toEqual([]);
    expect(settings.track_001.visible).toBe(true);
    expect(settings.track_001.deleted).toBe(true);
  });

  it("preserves prior edits when newly discovered tracks are added", () => {
    const edited = updateUserTrackSettings(
      createUserTrackSettings(tracks.slice(0, 1), {}),
      "track_001",
      { labelZh: "麻雀" },
    );

    expect(createUserTrackSettings(tracks, edited).track_001.labelZh).toBe("麻雀");
  });
});
