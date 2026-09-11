"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { Detection } from "../../features/detection/types";
import { fitVideoContain, videoToScreenPoint } from "../../features/overlay/canvasCoordinates";
import { LabelRenderer, type LabelDrawingContext } from "../../features/overlay/LabelRenderer";
import type { LabelSubject, Size } from "../../features/overlay/types";
import type { VideoMetadata, VideoSource } from "../../features/media/types";

interface VideoStageProps {
  detections?: Detection[];
  metadata: VideoMetadata | null;
  onTimeChange?: (time: number) => void;
  source: VideoSource;
  videoRef?: RefObject<HTMLVideoElement | null>;
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

export function renderDetections(
  context: LabelDrawingContext,
  detections: Detection[],
  video: Size,
  viewport: Size,
) {
  const videoRect = fitVideoContain(video, viewport);
  const subjects: LabelSubject[] = detections.map((detection) => ({
    id: detection.detectionId,
    labelZh: detection.category === "person" ? "人物" : detection.category,
    labelEn: detection.category,
    category: detection.category,
    confidence: detection.confidence,
    anchor: videoToScreenPoint(
      {
        x: detection.box.x + detection.box.width / 2,
        y: detection.box.y,
      },
      videoRect,
    ),
  }));

  previewRenderer.render(context, subjects, { ...viewport, preset: "data" });
}

export function VideoStage({ detections = [], metadata, onTimeChange, source, videoRef }: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !metadata) return;

    function drawOverlay() {
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

      renderDetections(
        context,
        detections,
        { width: metadata.width, height: metadata.height },
        { width: bounds.width, height: bounds.height },
      );
    }

    drawOverlay();
    const observer = new ResizeObserver(drawOverlay);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [detections, metadata]);

  return (
    <div ref={stageRef} className="relative h-full min-h-0 w-full overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" src={source.objectUrl} controls playsInline onTimeUpdate={(event) => onTimeChange?.(event.currentTarget.currentTime)} onSeeked={(event) => onTimeChange?.(event.currentTarget.currentTime)} />
      <canvas ref={canvasRef} aria-label="视频标签叠加层" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
