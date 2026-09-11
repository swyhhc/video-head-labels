"use client";

import { useEffect, useRef } from "react";

import { fitVideoContain, videoToScreenPoint } from "../../features/overlay/canvasCoordinates";
import { LabelRenderer, type LabelDrawingContext } from "../../features/overlay/LabelRenderer";
import type { LabelSubject, Size } from "../../features/overlay/types";
import type { VideoMetadata, VideoSource } from "../../features/media/types";

interface VideoStageProps {
  metadata: VideoMetadata | null;
  source: VideoSource;
}

const previewRenderer = new LabelRenderer();

export function renderDevelopmentPreview(
  context: LabelDrawingContext,
  video: Size,
  viewport: Size,
) {
  const videoRect = fitVideoContain(video, viewport);
  const subject: LabelSubject = {
    id: "development-preview",
    labelZh: "开发预览",
    labelEn: "Renderer 接线测试",
    anchor: videoToScreenPoint(
      { x: video.width / 2, y: video.height / 2 },
      videoRect,
    ),
  };

  previewRenderer.render(context, [subject], {
    ...viewport,
    preset: "classic",
  });
}

export function VideoStage({ metadata, source }: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !metadata) return;

    function drawAlignmentMarker() {
      if (!stage || !canvas || !metadata) return;
      const bounds = stage.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;

      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      renderDevelopmentPreview(
        context,
        { width: metadata.width, height: metadata.height },
        { width: bounds.width, height: bounds.height },
      );
    }

    drawAlignmentMarker();
    const observer = new ResizeObserver(drawAlignmentMarker);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [metadata]);

  return (
    <div ref={stageRef} className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl bg-black">
      <video className="absolute inset-0 h-full w-full object-contain" src={source.objectUrl} controls playsInline />
      <canvas ref={canvasRef} aria-label="视频标签叠加层" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
