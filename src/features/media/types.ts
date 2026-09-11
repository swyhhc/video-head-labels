export interface VideoSource {
  file: File;
  name: string;
  size: number;
  objectUrl: string;
}

export type VideoContainer = "mp4" | "mov" | "unknown";
export type VideoCodec = "h264" | "hevc" | "unknown";
export type VideoCompatibility = "direct" | "transcode_required" | "unknown";

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number | null;
  container: VideoContainer;
  codec: VideoCodec;
  compatibility: VideoCompatibility;
  warnings: string[];
}
