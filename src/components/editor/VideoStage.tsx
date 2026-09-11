"use client";

import { useEffect, useRef } from "react";

import { fitVideoContain, videoToScreenPoint } from "../../features/overlay/canvasCoordinates";
import type { VideoMetadata, VideoSource } from "../../features/media/types";

interface VideoStageProps {
  metadata: VideoMetadata | null;
  source: VideoSource;
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

      const videoRect = fitVideoContain(
        { width: metadata.width, height: metadata.height },
        { width: bounds.width, height: bounds.height },
      );
      const center = videoToScreenPoint(
        { x: metadata.width / 2, y: metadata.height / 2 },
        videoRect,
      );

      context.strokeStyle = "#6ED3CF";
      context.fillStyle = "#6ED3CF";
      context.lineWidth = 1.25;
      context.beginPath();
      context.moveTo(center.x, center.y - 28);
      context.lineTo(center.x, center.y - 8);
      context.stroke();
      context.beginPath();
      context.arc(center.x, center.y, 3.5, 0, Math.PI * 2);
      context.fill();
      context.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      context.textAlign = "center";
      context.fillText("叠加层对齐", center.x, center.y - 34);
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
