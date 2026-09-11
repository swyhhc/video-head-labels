import { describe, expect, it } from "vitest";

import { renderDevelopmentPreview, renderTrackedObservations } from "../../src/components/editor/VideoStage";
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

  it("renders the user's track name through the shared renderer", () => {
    const text: string[] = [];
    const context: LabelDrawingContext = {
      fillStyle: "", font: "", globalAlpha: 1, lineWidth: 1, shadowBlur: 0,
      shadowColor: "", strokeStyle: "", textAlign: "left", textBaseline: "alphabetic",
      beginPath() {}, fillText(value) { text.push(value); }, lineTo() {},
      measureText(value) { return { width: value.length * 10 }; }, moveTo() {}, restore() {}, save() {}, stroke() {},
    };

    renderTrackedObservations(context, [{
      trackId: "track_001",
      lifecycle: "active",
      detectionId: "sample-6-detection-1",
      classId: 0,
      category: "person",
      confidence: 0.82,
      box: { x: 800, y: 200, width: 320, height: 700 },
      labelZh: "小明",
      labelEn: "Ming",
    }], { width: 1920, height: 1080 }, { width: 800, height: 600 });

    expect(text).toEqual(["小明", "Ming", "person · 82%"]);
  });

  it("smooths label movement by stable track identity", () => {
    const points: Array<{ x: number; y: number }> = [];
    const context: LabelDrawingContext = {
      fillStyle: "", font: "", globalAlpha: 1, lineWidth: 1, shadowBlur: 0,
      shadowColor: "", strokeStyle: "", textAlign: "left", textBaseline: "alphabetic",
      beginPath() {}, fillText(_value, x, y) { points.push({ x, y }); }, lineTo() {},
      measureText(value) { return { width: value.length * 10 }; }, moveTo() {}, restore() {}, save() {}, stroke() {},
    };
    const anchors = new Map<string, { x: number; y: number }>();
    const base = {
      trackId: "track_001", lifecycle: "active" as const, classId: 0, category: "person",
      confidence: 0.8, labelZh: "小明", labelEn: "",
    };

    renderTrackedObservations(context, [{ ...base, detectionId: "d1", box: { x: 0, y: 100, width: 20, height: 40 } }], { width: 200, height: 200 }, { width: 200, height: 200 }, anchors);
    points.length = 0;
    renderTrackedObservations(context, [{ ...base, detectionId: "d2", box: { x: 100, y: 100, width: 20, height: 40 } }], { width: 200, height: 200 }, { width: 200, height: 200 }, anchors);

    expect(anchors.get("track_001")?.x).toBeGreaterThan(10);
    expect(anchors.get("track_001")?.x).toBeLessThan(110);
  });
});
