import { describe, expect, it } from "vitest";

import { inspectVideo } from "../../src/features/media/inspectVideo";

function localVideo(name: string, type: string, signature: string) {
  return new File([`....ftyp${signature}....`], name, { type });
}

const loadMetadata = async () => ({
  duration: 12.5,
  width: 1920,
  height: 1080,
});

describe("inspectVideo", () => {
  it("marks detected H.264 MP4 video as directly compatible", async () => {
    const result = await inspectVideo(
      localVideo("clip.mp4", "video/mp4", "avc1"),
      loadMetadata,
    );

    expect(result).toEqual({
      duration: 12.5,
      width: 1920,
      height: 1080,
      frameRate: null,
      container: "mp4",
      codec: "h264",
      compatibility: "direct",
      warnings: [],
    });
  });

  it.each(["hvc1", "hev1"])(
    "marks detected %s video as requiring local transcoding",
    async (signature) => {
      const result = await inspectVideo(
        localVideo("clip.mov", "video/quicktime", signature),
        loadMetadata,
      );

      expect(result.codec).toBe("hevc");
      expect(result.container).toBe("mov");
      expect(result.compatibility).toBe("transcode_required");
    },
  );

  it("returns unknown when codec evidence is absent", async () => {
    const result = await inspectVideo(
      localVideo("clip.mp4", "video/mp4", "mp4v"),
      loadMetadata,
    );

    expect(result.codec).toBe("unknown");
    expect(result.compatibility).toBe("unknown");
  });

  it("probes bounded file slices instead of copying the complete video", async () => {
    const chunk = new Uint8Array(600 * 1024);
    const file = new File([chunk, chunk, "hvc1"], "large.mov", {
      type: "video/quicktime",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: () => {
        throw new Error("whole-file read is not allowed");
      },
    });

    const result = await inspectVideo(file, loadMetadata);

    expect(result.codec).toBe("hevc");
  });

  it("reports configured duration and resolution limits", async () => {
    const result = await inspectVideo(
      localVideo("large.mp4", "video/mp4", "avc1"),
      async () => ({ duration: 31, width: 2160, height: 3840 }),
    );

    expect(result.warnings).toEqual([
      "视频超过 30 秒，请裁剪后重试",
      "视频分辨率超过 1920 × 1080",
    ]);
  });
});
