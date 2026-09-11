import { getLabelLines, layoutLabels } from "./labelLayout";
import type { LabelLine, LabelPreset, LabelSubject, Size } from "./types";

export interface LabelDrawingContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  globalAlpha: number;
  lineWidth: number;
  shadowBlur: number;
  shadowColor: string;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  beginPath(): void;
  fillText(text: string, x: number, y: number): void;
  lineTo(x: number, y: number): void;
  measureText(text: string): Pick<TextMetrics, "width">;
  moveTo(x: number, y: number): void;
  restore(): void;
  save(): void;
  stroke(): void;
}

interface RenderOptions extends Size {
  preset: LabelPreset;
}

interface PreparedLabel {
  subject: LabelSubject;
  lines: LabelLine[];
  width: number;
  height: number;
}

const LINE_HEIGHT = {
  primary: 22,
  secondary: 13,
  data: 13,
} as const;

export class LabelRenderer {
  render(
    context: LabelDrawingContext,
    subjects: LabelSubject[],
    options: RenderOptions,
  ) {
    const prepared = subjects
      .filter((subject) => subject.visible !== false)
      .map((subject) => this.prepare(context, subject, options.preset));
    const layouts = layoutLabels(
      prepared.map((item) => ({
        id: item.subject.id,
        anchor: item.subject.anchor,
        size: { width: item.width, height: item.height },
      })),
      options,
    );

    for (const item of prepared) {
      const layout = layouts.find((candidate) => candidate.id === item.subject.id);
      if (!layout) continue;

      context.save();
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "#FFFFFF";
      context.shadowColor = "rgba(0, 0, 0, 0.35)";
      context.shadowBlur = 2;

      if (options.preset !== "minimal") {
        context.beginPath();
        context.strokeStyle = "#FFFFFF";
        context.globalAlpha = 0.7;
        context.lineWidth = 1;
        context.moveTo(layout.guideStart.x, layout.guideStart.y);
        context.lineTo(layout.guideEnd.x, layout.guideEnd.y);
        context.stroke();
      }

      let y = layout.box.y;
      for (const line of item.lines) {
        context.font = fontFor(line.role);
        context.globalAlpha = line.role === "primary" ? 1 : 0.85;
        context.fillText(line.text, layout.box.x + layout.box.width / 2, y);
        y += LINE_HEIGHT[line.role];
      }
      context.restore();
    }
  }

  private prepare(
    context: LabelDrawingContext,
    subject: LabelSubject,
    preset: LabelPreset,
  ): PreparedLabel {
    const lines = getLabelLines(subject, preset);
    let textWidth = 0;
    for (const line of lines) {
      context.font = fontFor(line.role);
      textWidth = Math.max(textWidth, context.measureText(line.text).width);
    }

    return {
      subject,
      lines,
      width: textWidth + 12,
      height: lines.reduce((height, line) => height + LINE_HEIGHT[line.role], 0),
    };
  }
}

function fontFor(role: LabelLine["role"]) {
  const size = role === "primary" ? 18 : 10;
  const weight = role === "primary" ? 600 : 400;
  return `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}
