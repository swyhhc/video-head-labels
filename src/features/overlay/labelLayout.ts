import type {
  LabelBoxInput,
  LabelLayout,
  LabelLine,
  LabelPreset,
  LabelSubject,
  Size,
} from "./types";

const EDGE_PADDING = 8;
const GUIDE_GAP = 42;
const COLLISION_GAP = 8;

export function getLabelLines(
  label: LabelSubject,
  preset: LabelPreset,
): LabelLine[] {
  const lines: LabelLine[] = [{ text: label.labelZh, role: "primary" }];
  if (preset !== "minimal" && label.labelEn) {
    lines.push({ text: label.labelEn, role: "secondary" });
  }
  if (preset === "data") {
    const category = label.category ?? "未知类别";
    const confidence =
      label.confidence === undefined
        ? "置信度未知"
        : `${Math.round(label.confidence * 100)}%`;
    lines.push({ text: `${category} · ${confidence}`, role: "data" });
  }
  return lines;
}

function overlaps(a: LabelLayout["box"], b: LabelLayout["box"]) {
  return !(
    a.x + a.width + COLLISION_GAP <= b.x ||
    b.x + b.width + COLLISION_GAP <= a.x ||
    a.y + a.height + COLLISION_GAP <= b.y ||
    b.y + b.height + COLLISION_GAP <= a.y
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function layoutLabels(
  labels: LabelBoxInput[],
  bounds: Size,
): LabelLayout[] {
  const layouts: LabelLayout[] = [];

  for (const label of labels) {
    const preferredY = label.anchor.y - label.size.height - GUIDE_GAP;
    const offsets = [0, -(label.size.height + COLLISION_GAP), label.size.height + COLLISION_GAP, -2 * (label.size.height + COLLISION_GAP), 2 * (label.size.height + COLLISION_GAP)];
    const x = clamp(
      label.anchor.x - label.size.width / 2,
      EDGE_PADDING,
      Math.max(EDGE_PADDING, bounds.width - label.size.width - EDGE_PADDING),
    );

    let box = {
      x,
      y: clamp(
        preferredY,
        EDGE_PADDING,
        Math.max(EDGE_PADDING, bounds.height - label.size.height - EDGE_PADDING),
      ),
      ...label.size,
    };

    for (const offset of offsets) {
      const candidate = {
        ...box,
        y: clamp(
          preferredY + offset,
          EDGE_PADDING,
          Math.max(EDGE_PADDING, bounds.height - label.size.height - EDGE_PADDING),
        ),
      };
      if (!layouts.some((placed) => overlaps(candidate, placed.box))) {
        box = candidate;
        break;
      }
    }

    layouts.push({
      id: label.id,
      box,
      guideStart: { x: box.x + box.width / 2, y: box.y + box.height },
      guideEnd: { ...label.anchor },
    });
  }

  return layouts;
}
