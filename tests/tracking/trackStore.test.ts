import { describe, expect, it } from "vitest";

import {
  applyUserTrackSettings,
  autoNumberUserTrackSettings,
  copyPreviousTrackName,
  createUserTrackSettings,
  nextTrackId,
  updateManyUserTrackSettings,
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

  it("auto-numbers 30 subjects by category without overwriting manual names", () => {
    const manyTracks: Track[] = Array.from({ length: 30 }, (_, index) => ({
      trackId: `track_${String(index + 1).padStart(3, "0")}`,
      category: index % 2 === 0 ? "person" : "bird",
      confidence: 0.8,
      lifecycle: "active" as const,
      positions: [],
    }));
    let settings = createUserTrackSettings(manyTracks, {});
    settings = updateUserTrackSettings(settings, "track_003", { labelZh: "小明" });
    settings = autoNumberUserTrackSettings(manyTracks, settings);

    expect(settings.track_001.labelZh).toBe("人物1");
    expect(settings.track_002.labelZh).toBe("鸟1");
    expect(settings.track_003.labelZh).toBe("小明");
    expect(settings.track_029.labelZh).toBe("人物15");
    expect(settings.track_030.labelZh).toBe("鸟15");
    expect(settings.track_001.nameEdited).toBe(false);
    expect(settings.track_003.nameEdited).toBe(true);
  });

  it("updates selected subjects together while leaving other settings unchanged", () => {
    const settings = createUserTrackSettings(tracks, {});
    const renamed = updateManyUserTrackSettings(settings, ["track_001", "track_002"], { labelZh: "小明" });
    const hidden = updateManyUserTrackSettings(renamed, ["track_001"], { visible: false });

    expect(renamed.track_001.labelZh).toBe("小明");
    expect(renamed.track_002.labelZh).toBe("小明");
    expect(renamed.track_001.nameEdited).toBe(true);
    expect(hidden.track_001.visible).toBe(false);
    expect(hidden.track_002.visible).toBe(true);
  });

  it("copies the previous listed name and advances Enter focus through 30 stable ids", () => {
    const ids = Array.from({ length: 30 }, (_, index) => `track_${String(index + 1).padStart(3, "0")}`);
    let settings = createUserTrackSettings(tracks, {});
    settings = updateUserTrackSettings(settings, "track_001", { labelZh: "同一个人" });
    settings = copyPreviousTrackName(settings, "track_001", "track_002");

    expect(settings.track_002.labelZh).toBe("同一个人");
    expect(settings.track_002.nameEdited).toBe(true);
    expect(nextTrackId(ids, "track_001")).toBe("track_002");
    expect(nextTrackId(ids, "track_030")).toBeNull();
  });
});
