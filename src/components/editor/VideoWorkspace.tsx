"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DETECTION_CONFIG } from "../../features/detection/config";
import { buildSampleTimes, detectionsForPlaybackTime, type DetectionFrame } from "../../features/detection/sampledVideoDetection";
import type { BackendPreference, DetectorLoadMetrics } from "../../features/detection/types";
import type { DetectionWorkerClient } from "../../features/detection/workerClient";
import { createVideoSource } from "../../features/media/createVideoSource";
import { inspectVideo } from "../../features/media/inspectVideo";
import type { VideoMetadata, VideoSource } from "../../features/media/types";
import { VideoDropzone } from "./VideoDropzone";
import { VideoStage } from "./VideoStage";

type AnalysisStatus = "idle" | "loading" | "analyzing" | "completed" | "failed";

interface AnalysisSummary {
  elapsedMs: number;
  inferenceMs: number;
  sampledFrames: number;
  totalDetections: number;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VideoWorkspace() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [error, setError] = useState<string>();
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [frames, setFrames] = useState<DetectionFrame[]>([]);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisError, setAnalysisError] = useState<string>();
  const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 0 });
  const [loadMetrics, setLoadMetrics] = useState<DetectorLoadMetrics | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const inspectionId = useRef(0);
  const analysisId = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerClientRef = useRef<DetectionWorkerClient | null>(null);

  const visibleDetections = useMemo(
    () => detectionsForPlaybackTime(frames, playbackTime, DETECTION_CONFIG.sampleIntervalSeconds),
    [frames, playbackTime],
  );

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.objectUrl);
      workerClientRef.current?.dispose();
    };
  }, [source]);

  async function loadFile(file: File) {
    const currentInspection = ++inspectionId.current;
    cancelAnalysis();
    try {
      const nextSource = createVideoSource(file);
      setSource(nextSource);
      setError(undefined);
      setMetadata(null);
      setIsInspecting(true);
      resetAnalysisState();

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
    cancelAnalysis();
    setSource(null);
    setMetadata(null);
    setError(undefined);
    setIsInspecting(false);
    resetAnalysisState();
  }

  function cancelAnalysis() {
    analysisId.current += 1;
    workerClientRef.current?.dispose();
    workerClientRef.current = null;
  }

  function resetAnalysisState() {
    setFrames([]);
    setPlaybackTime(0);
    setAnalysisStatus("idle");
    setAnalysisError(undefined);
    setAnalysisProgress({ completed: 0, total: 0 });
    setLoadMetrics(null);
    setSummary(null);
  }

  async function analyzeVideo(preference: BackendPreference = "auto") {
    const video = videoRef.current;
    if (!video || !metadata || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      setAnalysisError("视频画面尚未准备好，请稍后重试");
      setAnalysisStatus("failed");
      return;
    }

    cancelAnalysis();
    const currentAnalysis = analysisId.current;
    setFrames([]);
    setSummary(null);
    setAnalysisError(undefined);
    setAnalysisStatus("loading");
    const times = buildSampleTimes(metadata.duration, DETECTION_CONFIG.sampleIntervalSeconds);
    setAnalysisProgress({ completed: 0, total: times.length });
    const startedAt = performance.now();
    const savedTime = video.currentTime;
    video.pause();

    try {
      const { DetectionWorkerClient: WorkerClient } = await import("../../features/detection/workerClient");
      const client = new WorkerClient();
      workerClientRef.current = client;
      const metrics = await client.initialize(preference);
      if (analysisId.current !== currentAnalysis) return;
      setLoadMetrics(metrics);
      setAnalysisStatus("analyzing");

      const nextFrames: DetectionFrame[] = [];
      let inferenceMs = 0;
      let totalDetections = 0;
      for (let index = 0; index < times.length; index += 1) {
        await seekVideo(video, times[index]);
        const bitmap = await createImageBitmap(video);
        const result = await client.detect(bitmap, metadata.width, metadata.height, index);
        if (analysisId.current !== currentAnalysis) return;
        nextFrames.push({ time: times[index], detections: result.detections, inferenceMs: result.inferenceMs });
        inferenceMs += result.inferenceMs;
        totalDetections += result.detections.length;
        setFrames([...nextFrames]);
        setAnalysisProgress({ completed: index + 1, total: times.length });
      }

      await seekVideo(video, Math.min(savedTime, metadata.duration));
      setSummary({ elapsedMs: performance.now() - startedAt, inferenceMs, sampledFrames: times.length, totalDetections });
      setAnalysisStatus("completed");
    } catch (failure) {
      if (analysisId.current !== currentAnalysis) return;
      setAnalysisError(failure instanceof Error ? failure.message : "本地分析失败");
      setAnalysisStatus("failed");
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
            <VideoStage detections={visibleDetections} metadata={metadata} onTimeChange={setPlaybackTime} source={source} videoRef={videoRef} />
          </div>
        </section>
        <aside className="border-l border-[#E8E8E5] bg-white p-6">
          <h2 className="text-base font-semibold">当前画面</h2>
          {visibleDetections.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {visibleDetections.map((detection) => (
                <li key={detection.detectionId} className="flex items-center justify-between rounded-lg border border-[#E8E8E5] px-3 py-2 text-xs">
                  <span>{detection.category === "person" ? "人物" : detection.category}</span>
                  <span className="text-[#777777]">{Math.round(detection.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-[#E8E8E5] bg-[#FAFAF8] px-4 py-8 text-center">
              <p className="text-sm text-[#777777]">{analysisStatus === "completed" ? "当前画面没有检测结果" : "尚未分析视频"}</p>
              <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">这里只显示模型真实检测到的主体</p>
            </div>
          )}
          <section className="mt-5 border-t border-[#E8E8E5] pt-5">
            <h3 className="text-sm font-medium">视频信息</h3>
            {isInspecting ? <p className="mt-3 text-xs text-[#777777]">正在读取本地视频信息…</p> : metadata ? <VideoInfo metadata={metadata} /> : <p className="mt-3 text-xs text-[#D94A4A]">{error ?? "无法读取视频信息"}</p>}
          </section>
          <AnalysisPanel
            error={analysisError}
            loadMetrics={loadMetrics}
            onAnalyze={analyzeVideo}
            progress={analysisProgress}
            status={analysisStatus}
            summary={summary}
          />
        </aside>
      </div>

      <section className="min-h-[116px] border-t border-[#E8E8E5] bg-white px-6 py-5 lg:px-8">
        <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
          <span>{formatDuration(playbackTime)}</span><span>{analysisStatus === "analyzing" ? `本地分析 ${analysisProgress.completed} / ${analysisProgress.total}` : analysisStatus === "completed" ? "本地分析完成" : "等待本地分析"}</span><span>{metadata ? formatDuration(metadata.duration) : "--:--"}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ECECEA]">
          <div className="h-full bg-[#6ED3CF] transition-[width]" style={{ width: `${analysisProgress.total ? (analysisProgress.completed / analysisProgress.total) * 100 : 0}%` }} />
        </div>
      </section>
    </main>
  );
}

function AnalysisPanel({ error, loadMetrics, onAnalyze, progress, status, summary }: {
  error?: string;
  loadMetrics: DetectorLoadMetrics | null;
  onAnalyze: (preference?: BackendPreference) => void;
  progress: { completed: number; total: number };
  status: AnalysisStatus;
  summary: AnalysisSummary | null;
}) {
  const busy = status === "loading" || status === "analyzing";
  const statusText = status === "loading" ? "正在 Worker 中加载模型…" : status === "analyzing" ? `正在分析 ${progress.completed} / ${progress.total}` : status === "completed" ? "分析完成" : status === "failed" ? "分析失败" : "模型尚未加载";
  return (
    <section className="mt-5 border-t border-[#E8E8E5] pt-5">
      <h3 className="text-sm font-medium">本地 AI 分析</h3>
      <p className="mt-2 text-xs leading-5 text-[#777777]">{statusText}</p>
      <button type="button" disabled={busy} onClick={() => onAnalyze("auto")} className="mt-3 w-full rounded-[10px] bg-[#6ED3CF] px-4 py-2.5 text-sm font-medium text-[#113B39] disabled:opacity-50">开始本地分析</button>
      <button type="button" disabled={busy} onClick={() => onAnalyze("wasm")} className="mt-2 w-full rounded-[10px] border border-[#E8E8E5] px-4 py-2 text-xs disabled:opacity-50">使用 WASM 兼容路径</button>
      {loadMetrics ? (
        <dl className="mt-4 grid grid-cols-[92px_1fr] gap-x-2 gap-y-2 text-xs">
          <dt className="text-[#A3A3A3]">实际后端</dt><dd>{loadMetrics.backend.toUpperCase()}</dd>
          <dt className="text-[#A3A3A3]">模型下载</dt><dd>{formatMs(loadMetrics.modelDownloadMs)}</dd>
          <dt className="text-[#A3A3A3]">模型初始化</dt><dd>{formatMs(loadMetrics.initializationMs)}</dd>
          <dt className="text-[#A3A3A3]">抽帧间隔</dt><dd>{DETECTION_CONFIG.sampleIntervalSeconds} 秒</dd>
          {summary ? <><dt className="text-[#A3A3A3]">分析总耗时</dt><dd>{formatMs(summary.elapsedMs)}</dd><dt className="text-[#A3A3A3]">纯推理耗时</dt><dd>{formatMs(summary.inferenceMs)}</dd><dt className="text-[#A3A3A3]">真实检测</dt><dd>{summary.totalDetections} 个 / {summary.sampledFrames} 帧</dd></> : null}
        </dl>
      ) : null}
      {error ? <p className="mt-3 rounded-lg bg-[#FFF0F0] px-3 py-2 text-xs leading-5 text-[#B83232]">{error}</p> : null}
    </section>
  );
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

async function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("读取抽样帧失败")); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} 秒` : `${value.toFixed(0)} ms`;
}
