import { describe, expect, it } from "vitest";

import {
  fitVideoContain,
  screenToVideoPoint,
  videoToScreenPoint,
} from "../../src/features/overlay/canvasCoordinates";

describe("canvas coordinates", () => {
  it("centers a landscape video inside a taller viewport", () => {
    expect(
      fitVideoContain(
        { width: 1920, height: 1080 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 0, y: 75, width: 800, height: 450, scale: 5 / 12 });
  });

  it("centers a portrait video inside a wide viewport", () => {
    expect(
      fitVideoContain(
        { width: 1080, height: 1920 },
        { width: 900, height: 600 },
      ),
    ).toEqual({ x: 281.25, y: 0, width: 337.5, height: 600, scale: 0.3125 });
  });

  it("maps video points to screen and back without losing coordinates", () => {
    const rect = fitVideoContain(
      { width: 1920, height: 1080 },
      { width: 800, height: 600 },
    );
    const screenPoint = videoToScreenPoint({ x: 960, y: 540 }, rect);

    expect(screenPoint).toEqual({ x: 400, y: 300 });
    expect(screenToVideoPoint(screenPoint, rect)).toEqual({ x: 960, y: 540 });
  });

  it("rejects empty video or viewport dimensions", () => {
    expect(() =>
      fitVideoContain({ width: 0, height: 1080 }, { width: 800, height: 600 }),
    ).toThrow("视频和画布尺寸必须大于 0");
  });
});
