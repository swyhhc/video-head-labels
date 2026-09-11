import type { Point } from "./types";

export function smoothPoint(
  previous: Point | null,
  target: Point,
  factor = 0.2,
): Point {
  if (factor < 0 || factor > 1) {
    throw new Error("平滑系数必须在 0 到 1 之间");
  }
  if (!previous) return { ...target };

  return {
    x: previous.x + (target.x - previous.x) * factor,
    y: previous.y + (target.y - previous.y) * factor,
  };
}
