"use client";

import { useEffect, useRef, type RefObject } from "react";

import { fitVideoContain, videoToScreenPoint } from "../../features/overlay/canvasCoordinates";
import { LabelRenderer, type LabelDrawingContext } from "../../features/overlay/LabelRenderer";
import { smoothPoint } from "../../features/overlay/labelSmoothing";
import type { LabelSubject, Size } from "../../features/overlay/types";
import type { VideoMetadata, VideoSource } from "../../features/media/types";
import type { DisplayTrackObservation } from "../../features/tracking/trackStore";

interface VideoStageProps {
  observations?: DisplayTrackObservation[];
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

export function renderTrackedObservations(
  context: LabelDrawingContext,
  observations: DisplayTrackObservation[],
  video: Size,
  viewport: Size,
  smoothedAnchors = new Map<string, { x: number; y: number }>(),
) {
  const videoRect = fitVideoContain(video, viewport);
  const visibleTrackIds = new Set(observations.map((observation) => observation.trackId));
  for (const trackId of smoothedAnchors.keys()) {
    if (!visibleTrackIds.has(trackId)) smoothedAnchors.delete(trackId);
  }
  const subjects: LabelSubject[] = observations.map((observation) => {
    const target = videoToScreenPoint(
      {
        x: observation.box.x + observation.box.width / 2,
        y: observation.box.y,
      },
      videoRect,
    );
    const anchor = smoothPoint(smoothedAnchors.get(observation.trackId) ?? null, target, 0.35);
    smoothedAnchors.set(observation.trackId, anchor);
    return {
      id: observation.trackId,
      labelZh: observation.labelZh,
      labelEn: observation.labelEn || undefined,
      category: observation.category,
      confidence: observation.confidence,
      anchor,
    };
  });

  previewRenderer.render(context, subjects, { ...viewport, preset: "data" });
}

export function VideoStage({ observations = [], metadata, onTimeChange, source, videoRef }: VideoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedAnchorsRef = useRef(new Map<string, { x: number; y: number }>());

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

      renderTrackedObservations(
        context,
        observations,
        { width: metadata.width, height: metadata.height },
        { width: bounds.width, height: bounds.height },
        smoothedAnchorsRef.current,
      );
    }

    drawOverlay();
    const observer = new ResizeObserver(drawOverlay);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [observations, metadata]);

  return (
    <div ref={stageRef} className="relative h-full min-h-0 w-full overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" src={source.objectUrl} controls playsInline onTimeUpdate={(event) => onTimeChange?.(event.currentTarget.currentTime)} onSeeked={(event) => onTimeChange?.(event.currentTarget.currentTime)} />
      <canvas ref={canvasRef} aria-label="视频标签叠加层" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
