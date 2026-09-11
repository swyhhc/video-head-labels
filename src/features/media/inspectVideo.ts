import { VIDEO_LIMITS } from "./config";
import type { VideoCodec, VideoContainer, VideoMetadata } from "./types";

interface NativeVideoMetadata {
  duration: number;
  width: number;
  height: number;
}

type MetadataLoader = (file: File) => Promise<NativeVideoMetadata>;

function detectContainer(file: File): VideoContainer {
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov") || file.type === "video/quicktime") return "mov";
  if (name.endsWith(".mp4") || file.type === "video/mp4") return "mp4";
  return "unknown";
}

async function detectCodec(file: File): Promise<VideoCodec> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("latin1").decode(bytes);

  if (signature.includes("hvc1") || signature.includes("hev1")) return "hevc";
  if (signature.includes("avc1") || signature.includes("avc3")) return "h264";
  return "unknown";
}

async function loadNativeMetadata(file: File): Promise<NativeVideoMetadata> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      video.onerror = () => reject(new Error("无法读取视频元信息，请确认文件可以正常播放"));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function inspectVideo(
  file: File,
  loadMetadata: MetadataLoader = loadNativeMetadata,
): Promise<VideoMetadata> {
  const [{ duration, width, height }, codec] = await Promise.all([
    loadMetadata(file),
    detectCodec(file),
  ]);
  const warnings: string[] = [];

  if (duration > VIDEO_LIMITS.maxDurationSeconds) {
    warnings.push("视频超过 30 秒，请裁剪后重试");
  }
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  if (longEdge > VIDEO_LIMITS.maxWidth || shortEdge > VIDEO_LIMITS.maxHeight) {
    warnings.push("视频分辨率超过 1920 × 1080");
  }

  return {
    duration,
    width,
    height,
    frameRate: null,
    container: detectContainer(file),
    codec,
    compatibility:
      codec === "h264"
        ? "direct"
        : codec === "hevc"
          ? "transcode_required"
          : "unknown",
    warnings,
  };
}
