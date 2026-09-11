import type { DetectionBox } from "../detection/types";

export type AppearanceDescriptor = readonly number[];

const GRID_SIZE = 2;
const HUE_BINS = 8;
const SATURATION_BINS = 4;
const VALUE_BINS = 4;
const FEATURES_PER_BLOCK = HUE_BINS + SATURATION_BINS + VALUE_BINS;
const MAX_SAMPLES_PER_AXIS = 32;

export function extractAppearance(
  pixels: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  box: DetectionBox,
): number[] | null {
  const left = clamp(Math.floor(box.x), 0, imageWidth);
  const top = clamp(Math.floor(box.y), 0, imageHeight);
  const right = clamp(Math.ceil(box.x + box.width), 0, imageWidth);
  const bottom = clamp(Math.ceil(box.y + box.height), 0, imageHeight);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0 || pixels.length < imageWidth * imageHeight * 4) return null;

  const descriptor = Array(GRID_SIZE * GRID_SIZE * FEATURES_PER_BLOCK + 1).fill(0);
  const stepX = Math.max(1, Math.ceil(width / MAX_SAMPLES_PER_AXIS));
  const stepY = Math.max(1, Math.ceil(height / MAX_SAMPLES_PER_AXIS));
  let samples = 0;

  for (let y = top; y < bottom; y += stepY) {
    for (let x = left; x < right; x += stepX) {
      const pixelOffset = (y * imageWidth + x) * 4;
      if (pixels[pixelOffset + 3] < 32) continue;
      const [hue, saturation, value] = rgbToHsv(
        pixels[pixelOffset],
        pixels[pixelOffset + 1],
        pixels[pixelOffset + 2],
      );
      const blockX = Math.min(GRID_SIZE - 1, Math.floor(((x - left) / width) * GRID_SIZE));
      const blockY = Math.min(GRID_SIZE - 1, Math.floor(((y - top) / height) * GRID_SIZE));
      const blockOffset = (blockY * GRID_SIZE + blockX) * FEATURES_PER_BLOCK;
      descriptor[blockOffset + Math.min(HUE_BINS - 1, Math.floor(hue * HUE_BINS))] += 2;
      descriptor[blockOffset + HUE_BINS + Math.min(SATURATION_BINS - 1, Math.floor(saturation * SATURATION_BINS))] += 1;
      descriptor[blockOffset + HUE_BINS + SATURATION_BINS + Math.min(VALUE_BINS - 1, Math.floor(value * VALUE_BINS))] += 1;
      samples += 1;
    }
  }

  if (samples === 0) return null;
  descriptor[descriptor.length - 1] = Math.tanh(Math.log(width / height)) * samples * 0.25;
  return normalize(descriptor);
}

export function compareAppearance(
  left: AppearanceDescriptor | null | undefined,
  right: AppearanceDescriptor | null | undefined,
): number | null {
  if (!left || !right || left.length === 0 || left.length !== right.length) return null;
  let similarity = 0;
  for (let index = 0; index < left.length; index += 1) similarity += left[index] * right[index];
  return clamp(1 - similarity, 0, 1);
}

export function updateTrackAppearance(
  current: AppearanceDescriptor | null | undefined,
  observation: AppearanceDescriptor,
  alpha: number,
) {
  if (alpha <= 0 || alpha > 1) throw new Error("外观 EMA 系数必须大于 0 且不超过 1");
  if (!current || current.length !== observation.length) return normalize([...observation]);
  return normalize(current.map((value, index) => value * (1 - alpha) + observation[index] * alpha));
}

function rgbToHsv(redByte: number, greenByte: number, blueByte: number) {
  const red = redByte / 255;
  const green = greenByte / 255;
  const blue = blueByte / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const range = maximum - minimum;
  let hue = 0;
  if (range > 0) {
    if (maximum === red) hue = ((green - blue) / range) % 6;
    else if (maximum === green) hue = (blue - red) / range + 2;
    else hue = (red - green) / range + 4;
    hue = (hue / 6 + 1) % 1;
  }
  return [hue, maximum === 0 ? 0 : range / maximum, maximum] as const;
}

function normalize(values: number[]) {
  const length = Math.hypot(...values);
  return length === 0 ? values : values.map((value) => value / length);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
