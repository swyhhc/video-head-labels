export const VIDEO_LIMITS = {
  acceptedExtensions: [".mp4", ".mov"],
  acceptedMimeTypes: ["video/mp4", "video/quicktime"],
  maxBytes: 100 * 1024 * 1024,
  maxDurationSeconds: 30,
  recommendedDurationSeconds: 15,
  maxWidth: 1920,
  maxHeight: 1080,
  maxFrameRate: 30,
} as const;
