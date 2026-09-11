"use client";

import { useEffect, useRef, useState } from "react";

import type { BrowserDetector } from "../../features/detection/browserDetector";
import type { BackendPreference, Detection, DetectorLoadMetrics } from "../../features/detection/types";
import { createVideoSource } from "../../features/media/createVideoSource";
import { inspectVideo } from "../../features/media/inspectVideo";
import type { VideoMetadata, VideoSource } from "../../features/media/types";
import { VideoDropzone } from "./VideoDropzone";
import { VideoStage } from "./VideoStage";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VideoWorkspace() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [error, setError] = useState<string>();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const inspectionId = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<BrowserDetector | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [spikeStatus, setSpikeStatus] = useState<"idle" | "loading" | "running" | "completed" | "failed">("idle");
  const [spikeError, setSpikeError] = useState<string>();
  const [loadMetrics, setLoadMetrics] = useState<DetectorLoadMetrics | null>(null);
  const [inferenceMetrics, setInferenceMetrics] = useState<{ first: number; warm: number; count: number; maxConfidence: number } | null>(null);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.objectUrl);
      void detectorRef.current?.dispose();
    };
  }, [source]);

  async function loadFile(file: File) {
    const currentInspection = ++inspectionId.current;
    try {
      const nextSource = createVideoSource(file);
      setSource(nextSource);
      setError(undefined);
      setMetadata(null);
      setIsInspecting(true);
      setDetections([]);
      setSpikeStatus("idle");
      setLoadMetrics(null);
      setInferenceMetrics(null);

      const result = await inspectVideo(nextSource.file);
      if (inspectionId.current === currentInspection) setMetadata(result);
    } catch (loadError) {
      if (inspectionId.current === currentInspection) {
        setError(loadError instanceof Error ? loadError.message : "无法读取这个视频");
      }
    } finally {
      if (inspectionId.current === currentInspection) setIsInspecting(false);
    }
  }

  function resetVideo() {
    inspectionId.current += 1;
    setSource(null);
    setMetadata(null);
    setError(undefined);
    setIsInspecting(false);
    setDetections([]);
    setSpikeStatus("idle");
    setLoadMetrics(null);
    setInferenceMetrics(null);
    void detectorRef.current?.dispose();
    detectorRef.current = null;
  }

  async function runSingleFrameSpike(preference: BackendPreference = "auto") {
    const video = videoRef.current;
    if (!video || !metadata || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setSpikeError("视频画面尚未准备好，请播放或拖动一次时间轴后重试");
      setSpikeStatus("failed");
      return;
    }

    setSpikeError(undefined);
    setSpikeStatus("loading");
    const detector = detectorRef.current ?? new (await import("../../features/detection/browserDetector")).BrowserDetector();
    detectorRef.current = detector;
    try {
      const nextLoadMetrics = await detector.initialize(preference);
      setLoadMetrics(nextLoadMetrics);
      setSpikeStatus("running");
      const first = await detector.detect(video, metadata.width, metadata.height);
      const warm = await detector.detect(video, metadata.width, metadata.height);
      setDetections(first.detections);
      setInferenceMetrics({ first: first.inferenceMs, warm: warm.inferenceMs, count: first.detections.length, maxConfidence: first.maxConfidence });
      setSpikeStatus("completed");
    } catch (spikeFailure) {
      setSpikeError(spikeFailure instanceof Error ? spikeFailure.message : "本地检测失败");
      setSpikeStatus("failed");
    }
  }

  if (!source) return <VideoDropzone error={error} onFile={loadFile} />;

  return (
    <main className="flex min-h-screen flex-col bg-[#F7F7F5] text-[#171717]">
      <header className="flex min-h-[76px] items-center justify-between border-b border-[#E8E8E5] bg-white px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-[-0.02em]">视频头顶加字幕</h1>
            <span className="rounded-full bg-[#F1F1EF] px-2.5 py-1 text-xs text-[#777777]">仅本地处理</span>
          </div>
          <p className="mt-1 max-w-[52vw] truncate text-xs text-[#777777]">{source.name} · {formatBytes(source.size)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-[10px] border border-[#E8E8E5] bg-white px-4 py-2.5 text-sm transition-colors hover:bg-[#F1F1EF]" onClick={resetVideo}>重新上传</button>
          <button type="button" disabled className="rounded-[10px] bg-[#6ED3CF] px-4 py-2.5 text-sm font-medium text-[#113B39] opacity-50">导出视频</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-[420px] items-center justify-center bg-[#ECECEA] p-6 lg:p-8">
          <div className="h-[min(62vh,720px)] w-full max-w-[1200px]">
            <VideoStage detections={detections} metadata={metadata} source={source} videoRef={videoRef} />
          </div>
        </section>
        <aside className="border-l border-[#E8E8E5] bg-white p-6">
          <h2 className="text-base font-semibold">主体</h2>
          <div className="mt-6 rounded-xl border border-[#E8E8E5] bg-[#FAFAF8] px-4 py-8 text-center">
            <p className="text-sm text-[#777777]">尚未分析视频</p>
            <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">主体会在本地分析完成后显示在这里</p>
          </div>
          <section className="mt-5 border-t border-[#E8E8E5] pt-5">
            <h3 className="text-sm font-medium">视频信息</h3>
            {isInspecting ? (
              <p className="mt-3 text-xs text-[#777777]">正在读取本地视频信息…</p>
            ) : metadata ? (
              <VideoInfo metadata={metadata} />
            ) : (
              <p className="mt-3 text-xs text-[#D94A4A]">{error ?? "无法读取视频信息"}</p>
            )}
          </section>
          <DetectionSpikePanel
            error={spikeError}
            inferenceMetrics={inferenceMetrics}
            loadMetrics={loadMetrics}
            onRun={runSingleFrameSpike}
            status={spikeStatus}
          />
        </aside>
      </div>

      <section className="min-h-[116px] border-t border-[#E8E8E5] bg-white px-6 py-5 lg:px-8">
        <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
          <span>00:00</span><span>时间轴将在分析后显示</span><span>--:--</span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#ECECEA]" />
      </section>
    </main>
  );
}

function DetectionSpikePanel({
  error,
  inferenceMetrics,
  loadMetrics,
  onRun,
  status,
}: {
  error?: string;
  inferenceMetrics: { first: number; warm: number; count: number; maxConfidence: number } | null;
  loadMetrics: DetectorLoadMetrics | null;
  onRun: (preference?: BackendPreference) => void;
  status: "idle" | "loading" | "running" | "completed" | "failed";
}) {
  const busy = status === "loading" || status === "running";
  return (
    <section className="mt-5 border-t border-[#E8E8E5] pt-5">
      <h3 className="text-sm font-medium">本地检测验证</h3>
      <p className="mt-2 text-xs leading-5 text-[#777777]">
        {status === "loading" ? "正在加载模型…" : status === "running" ? "正在运行真实单帧检测…" : status === "completed" ? "真实单帧检测完成" : status === "failed" ? "检测失败" : "尚未加载模型"}
      </p>
      <button type="button" disabled={busy} onClick={() => onRun("auto")} className="mt-3 w-full rounded-[10px] bg-[#6ED3CF] px-4 py-2.5 text-sm font-medium text-[#113B39] disabled:opacity-50">
        运行单帧验证
      </button>
      <button type="button" disabled={busy} onClick={() => onRun("wasm")} className="mt-2 w-full rounded-[10px] border border-[#E8E8E5] px-4 py-2 text-xs disabled:opacity-50">
        强制验证 WASM
      </button>
      {loadMetrics ? (
        <dl className="mt-4 grid grid-cols-[92px_1fr] gap-x-2 gap-y-2 text-xs">
          <dt className="text-[#A3A3A3]">实际后端</dt><dd>{loadMetrics.backend.toUpperCase()}</dd>
          <dt className="text-[#A3A3A3]">模型下载</dt><dd>{formatMs(loadMetrics.modelDownloadMs)}</dd>
          <dt className="text-[#A3A3A3]">模型初始化</dt><dd>{formatMs(loadMetrics.initializationMs)}</dd>
          <dt className="text-[#A3A3A3]">模型大小</dt><dd>{formatBytes(loadMetrics.modelBytes)}</dd>
          <dt className="text-[#A3A3A3]">内存观察</dt><dd>{formatMemory(loadMetrics)}</dd>
          {inferenceMetrics ? <><dt className="text-[#A3A3A3]">首帧推理</dt><dd>{formatMs(inferenceMetrics.first)}</dd><dt className="text-[#A3A3A3]">后续单帧</dt><dd>{formatMs(inferenceMetrics.warm)}</dd><dt className="text-[#A3A3A3]">最高置信度</dt><dd>{Math.round(inferenceMetrics.maxConfidence * 100)}%</dd><dt className="text-[#A3A3A3]">真实检测</dt><dd>{inferenceMetrics.count} 个</dd></> : null}
        </dl>
      ) : null}
      {error ? <p className="mt-3 rounded-lg bg-[#FFF0F0] px-3 py-2 text-xs leading-5 text-[#B83232]">{error}</p> : null}
    </section>
  );
}

function formatMs(value: number) {
  return `${value.toFixed(0)} ms`;
}

function formatMemory(metrics: DetectorLoadMetrics) {
  if (!metrics.memoryBefore.available || !metrics.memoryAfter.available) return "浏览器未提供";
  const delta = (metrics.memoryAfter.usedJSHeapBytes ?? 0) - (metrics.memoryBefore.usedJSHeapBytes ?? 0);
  return `${delta >= 0 ? "+" : ""}${formatBytes(delta)}`;
}

function VideoInfo({ metadata }: { metadata: VideoMetadata }) {
  const codecLabel = metadata.codec === "h264" ? "H.264" : metadata.codec === "hevc" ? "HEVC" : "未知";
  const compatibilityLabel = metadata.compatibility === "direct" ? "可直接处理" : metadata.compatibility === "transcode_required" ? "后续需要本地转码" : "编码暂时无法确认";

  return (
    <div className="mt-3 space-y-3 text-xs">
      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2">
        <dt className="text-[#A3A3A3]">时长</dt><dd>{formatDuration(metadata.duration)}</dd>
        <dt className="text-[#A3A3A3]">分辨率</dt><dd>{metadata.width} × {metadata.height}</dd>
        <dt className="text-[#A3A3A3]">容器</dt><dd>{metadata.container.toUpperCase()}</dd>
        <dt className="text-[#A3A3A3]">编码</dt><dd>{codecLabel}</dd>
        <dt className="text-[#A3A3A3]">兼容性</dt><dd>{compatibilityLabel}</dd>
      </dl>
      {metadata.warnings.map((warning) => <p key={warning} className="rounded-lg bg-[#FFF6EA] px-3 py-2 leading-5 text-[#9A5D13]">{warning}</p>)}
      <p className="leading-5 text-[#A3A3A3]">帧率将在后续处理阶段确认；当前不会猜测。</p>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
