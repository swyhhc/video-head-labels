import { describe, expect, it } from "vitest";

import {
  compareAppearance,
  extractAppearance,
  updateTrackAppearance,
} from "../../src/features/tracking/appearance";

function image(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue] = pixel(x, y);
      data.set([red, green, blue, 255], offset);
    }
  }
  return data;
}

describe("appearance descriptor", () => {
  it("treats the same crop as identical and different colors as distinct", () => {
    const red = extractAppearance(image(16, 16, () => [220, 20, 20]), 16, 16, { x: 0, y: 0, width: 16, height: 16 });
    const blue = extractAppearance(image(16, 16, () => [20, 20, 220]), 16, 16, { x: 0, y: 0, width: 16, height: 16 });

    expect(red).not.toBeNull();
    expect(compareAppearance(red, red)).toBeCloseTo(0, 6);
    expect(compareAppearance(red, blue)).toBeGreaterThan(0.4);
  });

  it("uses spatial color blocks to distinguish reversed appearances", () => {
    const leftRed = extractAppearance(
      image(20, 20, (x) => x < 10 ? [220, 20, 20] : [20, 20, 220]),
      20,
      20,
      { x: 0, y: 0, width: 20, height: 20 },
    );
    const leftBlue = extractAppearance(
      image(20, 20, (x) => x < 10 ? [20, 20, 220] : [220, 20, 20]),
      20,
      20,
      { x: 0, y: 0, width: 20, height: 20 },
    );

    expect(compareAppearance(leftRed, leftBlue)).toBeGreaterThan(0.2);
  });

  it("keeps aspect ratio meaningful alongside color histograms", () => {
    const pixels = image(32, 32, () => [120, 80, 40]);
    const tall = extractAppearance(pixels, 32, 32, { x: 0, y: 0, width: 16, height: 32 });
    const wide = extractAppearance(pixels, 32, 32, { x: 0, y: 0, width: 32, height: 16 });

    expect(compareAppearance(tall, wide)).toBeGreaterThan(0.02);
  });

  it("updates track appearance with an EMA instead of replacing its history", () => {
    const updated = updateTrackAppearance([1, 0], [0, 1], 0.25);

    expect(updated[0]).toBeGreaterThan(updated[1]);
    expect(Math.hypot(...updated)).toBeCloseTo(1, 6);
  });

  it("returns no descriptor for an invalid or empty crop", () => {
    expect(extractAppearance(new Uint8ClampedArray(16), 2, 2, { x: 4, y: 4, width: 0, height: 0 })).toBeNull();
    expect(compareAppearance(null, [1, 0])).toBeNull();
  });
});
