import { describe, expect, it } from "vitest";

import { VIDEO_LIMITS } from "../../src/features/media/config";
import { createVideoSource } from "../../src/features/media/createVideoSource";

function videoFile(
  name: string,
  type: string,
  size = 16,
): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("createVideoSource", () => {
  it.each([
    ["clip.mp4", "video/mp4"],
    ["clip.mov", "video/quicktime"],
  ])("accepts a local %s video", (name, type) => {
    const file = videoFile(name, type);
    const source = createVideoSource(file, () => "blob:local-video");

    expect(source).toEqual({
      file,
      name,
      size: file.size,
      objectUrl: "blob:local-video",
    });
  });

  it("rejects unsupported files before creating an object URL", () => {
    const file = videoFile("clip.webm", "video/webm");
    let objectUrlCreated = false;

    expect(() =>
      createVideoSource(file, () => {
        objectUrlCreated = true;
        return "blob:should-not-exist";
      }),
    ).toThrow("请选择 MP4 或 MOV 视频");
    expect(objectUrlCreated).toBe(false);
  });

  it("rejects files over the configured hard limit", () => {
    const file = videoFile(
      "too-large.mp4",
      "video/mp4",
      VIDEO_LIMITS.maxBytes + 1,
    );

    expect(() => createVideoSource(file, () => "blob:unused")).toThrow(
      "视频不能超过 100 MB",
    );
  });
});
