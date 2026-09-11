import type { FittedVideoRect, Point, Size } from "./types";

export function fitVideoContain(video: Size, viewport: Size): FittedVideoRect {
  if (
    video.width <= 0 ||
    video.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    throw new Error("视频和画布尺寸必须大于 0");
  }

  const scale = Math.min(
    viewport.width / video.width,
    viewport.height / video.height,
  );
  const width = video.width * scale;
  const height = video.height * scale;

  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function videoToScreenPoint(point: Point, rect: FittedVideoRect): Point {
  return {
    x: rect.x + point.x * rect.scale,
    y: rect.y + point.y * rect.scale,
  };
}

export function screenToVideoPoint(point: Point, rect: FittedVideoRect): Point {
  return {
    x: (point.x - rect.x) / rect.scale,
    y: (point.y - rect.y) / rect.scale,
  };
}
