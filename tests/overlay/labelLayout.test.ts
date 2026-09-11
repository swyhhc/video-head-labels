import { describe, expect, it } from "vitest";

import { getLabelLines, layoutLabels } from "../../src/features/overlay/labelLayout";

const label = {
  id: "bird-1",
  labelZh: "麻雀",
  labelEn: "Tree Sparrow",
  category: "Bird",
  confidence: 0.923,
  anchor: { x: 200, y: 180 },
};

describe("label layout", () => {
  it("builds the three specified label presets", () => {
    expect(getLabelLines(label, "classic").map((line) => line.text)).toEqual([
      "麻雀",
      "Tree Sparrow",
    ]);
    expect(getLabelLines(label, "minimal").map((line) => line.text)).toEqual([
      "麻雀",
    ]);
    expect(getLabelLines(label, "data").map((line) => line.text)).toEqual([
      "麻雀",
      "Tree Sparrow",
      "Bird · 92%",
    ]);
  });

  it("moves colliding labels apart while keeping each guide on its anchor", () => {
    const layouts = layoutLabels(
      [
        { id: "one", anchor: { x: 200, y: 180 }, size: { width: 120, height: 52 } },
        { id: "two", anchor: { x: 205, y: 180 }, size: { width: 120, height: 52 } },
      ],
      { width: 400, height: 300 },
    );

    expect(layouts[0].box.y).not.toBe(layouts[1].box.y);
    expect(layouts[0].guideEnd).toEqual({ x: 200, y: 180 });
    expect(layouts[1].guideEnd).toEqual({ x: 205, y: 180 });
  });
});
