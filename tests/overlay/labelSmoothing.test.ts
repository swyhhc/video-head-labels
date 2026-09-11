import { describe, expect, it } from "vitest";

import { smoothPoint } from "../../src/features/overlay/labelSmoothing";

describe("smoothPoint", () => {
  it("moves a label partway toward its latest target", () => {
    expect(smoothPoint({ x: 100, y: 50 }, { x: 140, y: 70 }, 0.25)).toEqual({
      x: 110,
      y: 55,
    });
  });

  it("uses the target directly when there is no previous position", () => {
    expect(smoothPoint(null, { x: 140, y: 70 })).toEqual({ x: 140, y: 70 });
  });

  it("rejects smoothing factors outside zero and one", () => {
    expect(() => smoothPoint({ x: 0, y: 0 }, { x: 1, y: 1 }, 1.2)).toThrow(
      "平滑系数必须在 0 到 1 之间",
    );
  });
});
