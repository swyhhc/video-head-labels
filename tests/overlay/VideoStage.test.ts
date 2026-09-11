import { describe, expect, it } from "vitest";

import { renderDevelopmentPreview } from "../../src/components/editor/VideoStage";
import type { LabelDrawingContext } from "../../src/features/overlay/LabelRenderer";

describe("VideoStage preview renderer wiring", () => {
  it("renders the explicit development preview through the shared renderer", () => {
    const text: string[] = [];
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
      lineTo() {},
      measureText(value) { return { width: value.length * 10 }; },
      moveTo() {},
      restore() {},
      save() {},
      stroke() {},
    };

    renderDevelopmentPreview(
      context,
      { width: 1920, height: 1080 },
      { width: 800, height: 600 },
    );

    expect(text).toEqual(["开发预览", "Renderer 接线测试"]);
  });
});
