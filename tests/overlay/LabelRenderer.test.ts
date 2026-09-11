import { describe, expect, it } from "vitest";

import { LabelRenderer, type LabelDrawingContext } from "../../src/features/overlay/LabelRenderer";

function recordingContext() {
  const text: string[] = [];
  const lines: Array<[number, number, number, number]> = [];
  let start = { x: 0, y: 0 };

  const context: LabelDrawingContext = {
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: "",
    strokeStyle: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    beginPath() {},
    fillText(value) { text.push(value); },
    lineTo(x, y) { lines.push([start.x, start.y, x, y]); },
    measureText(value) { return { width: value.length * 10 }; },
    moveTo(x, y) { start = { x, y }; },
    restore() {},
    save() {},
    stroke() {},
  };

  return { context, lines, text };
}

const subject = {
  id: "bird-1",
  labelZh: "麻雀",
  labelEn: "Tree Sparrow",
  category: "Bird",
  confidence: 0.923,
  anchor: { x: 200, y: 180 },
};

describe("LabelRenderer", () => {
  it("draws classic bilingual text and a thin guide line", () => {
    const output = recordingContext();
    new LabelRenderer().render(output.context, [subject], {
      width: 400,
      height: 300,
      preset: "classic",
    });

    expect(output.text).toEqual(["麻雀", "Tree Sparrow"]);
    expect(output.lines).toHaveLength(1);
    expect(output.lines[0].slice(2)).toEqual([200, 180]);
  });

  it("draws only Chinese text and no guide in minimal mode", () => {
    const output = recordingContext();
    new LabelRenderer().render(output.context, [subject], {
      width: 400,
      height: 300,
      preset: "minimal",
    });

    expect(output.text).toEqual(["麻雀"]);
    expect(output.lines).toHaveLength(0);
  });

  it("does not render hidden subjects", () => {
    const output = recordingContext();
    new LabelRenderer().render(output.context, [{ ...subject, visible: false }], {
      width: 400,
      height: 300,
      preset: "data",
    });

    expect(output.text).toEqual([]);
  });
});
