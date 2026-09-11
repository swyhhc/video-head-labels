import { VIDEO_LIMITS } from "./config";
import type { VideoSource } from "./types";

type ObjectUrlFactory = (file: File) => string;

function hasAcceptedExtension(name: string) {
  const normalizedName = name.toLowerCase();
  return VIDEO_LIMITS.acceptedExtensions.some((extension) =>
    normalizedName.endsWith(extension),
  );
}

export function createVideoSource(
  file: File,
  createObjectUrl: ObjectUrlFactory = URL.createObjectURL,
): VideoSource {
  const hasAcceptedType = VIDEO_LIMITS.acceptedMimeTypes.includes(
    file.type as (typeof VIDEO_LIMITS.acceptedMimeTypes)[number],
  );

  if (!hasAcceptedType && !hasAcceptedExtension(file.name)) {
    throw new Error("请选择 MP4 或 MOV 视频");
  }

  if (file.size > VIDEO_LIMITS.maxBytes) {
    throw new Error("视频不能超过 100 MB，请裁剪或压缩后重试");
  }

  return {
    file,
    name: file.name,
    size: file.size,
    objectUrl: createObjectUrl(file),
  };
}
