import { describe, expect, it } from "vitest";

import {
  calculateLetterbox,
  decodeYoloOutput,
} from "../../src/features/detection/browserDetector";

describe("browser detector geometry", () => {
  it("letterboxes a landscape frame without distorting it", () => {
    expect(calculateLetterbox(1920, 1080, 640)).toEqual({
      inputSize: 640,
      scaledWidth: 640,
      scaledHeight: 360,
      padX: 0,
      padY: 140,
      scale: 1 / 3,
    });
  });

  it("maps YOLO output back to original video coordinates", () => {
    const values = new Float32Array(84 * 2);
    values[0] = 320;
    values[2] = 320;
    values[4] = 64;
    values[6] = 128;
    values[8] = 0.9;

    expect(
      decodeYoloOutput(values, [1, 84, 2], {
        inputSize: 640,
        scaledWidth: 640,
        scaledHeight: 360,
        padX: 0,
        padY: 140,
        scale: 1 / 3,
      }),
    ).toEqual([
      {
        detectionId: "frame-detection-0",
        classId: 0,
        category: "person",
        confidence: expect.closeTo(0.9),
        box: { x: 864, y: 348, width: 192, height: 384 },
      },
    ]);
  });

  it("suppresses overlapping boxes from the same class", () => {
    const values = new Float32Array(84 * 2);
    for (let index = 0; index < 2; index += 1) {
      values[index] = 320 + index * 2;
      values[2 * 2 + index] = 100;
      values[3 * 2 + index] = 200;
      values[4 * 2 + index] = 0.9 - index * 0.1;
    }
    values[1 * 2] = 320;
    values[1 * 2 + 1] = 322;

    const detections = decodeYoloOutput(values, [1, 84, 2], {
      inputSize: 640,
      scaledWidth: 640,
      scaledHeight: 640,
      padX: 0,
      padY: 0,
      scale: 1,
    });

    expect(detections).toHaveLength(1);
    expect(detections[0].confidence).toBeCloseTo(0.9);
  });
});
