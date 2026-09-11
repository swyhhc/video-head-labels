"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DETECTION_CONFIG } from "../../features/detection/config";
import { buildSampleTimes, type DetectionFrame } from "../../features/detection/sampledVideoDetection";
import type { BackendPreference, DetectorLoadMetrics } from "../../features/detection/types";
import type { DetectionWorkerClient } from "../../features/detection/workerClient";
import { createVideoSource } from "../../features/media/createVideoSource";
import { inspectVideo } from "../../features/media/inspectVideo";
import type { VideoMetadata, VideoSource } from "../../features/media/types";
import {
  applyUserTrackSettings,
  autoNumberUserTrackSettings,
  categoryLabel,
  copyPreviousTrackName,
  createUserTrackSettings,
  nextTrackId,
  updateManyUserTrackSettings,
  updateUserTrackSettings,
  type UserTrackSettingsMap,
} from "../../features/tracking/trackStore";
import { observationsForPlaybackTime, trackDetectionFrames } from "../../features/tracking/tracker";
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
  const [trackSettings, setTrackSettings] = useState<UserTrackSettingsMap>({});
  const [pendingDeleteTrackId, setPendingDeleteTrackId] = useState<string>();
  const [editingTrackId, setEditingTrackId] = useState<string>();
  const [isSubjectListExpanded, setIsSubjectListExpanded] = useState(false);
  const [isBulkNaming, setIsBulkNaming] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set());
  const [bulkLabelZh, setBulkLabelZh] = useState("");
  const [confirmAutoNumber, setConfirmAutoNumber] = useState(false);
  const inspectionId = useRef(0);
  const analysisId = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerClientRef = useRef<DetectionWorkerClient | null>(null);
  const bulkNameInputRefs = useRef(new Map<string, HTMLInputElement>());

  const tracking = useMemo(() => trackDetectionFrames(frames), [frames]);
  const resolvedTrackSettings = useMemo(
    () => createUserTrackSettings(tracking.tracks, trackSettings),
    [tracking.tracks, trackSettings],
  );
  const visibleObservations = useMemo(
    () => applyUserTrackSettings(
      observationsForPlaybackTime(tracking.frames, playbackTime, DETECTION_CONFIG.sampleIntervalSeconds),
      resolvedTrackSettings,
    ),
    [playbackTime, resolvedTrackSettings, tracking.frames],
  );
  const listedTracks = useMemo(
    () => tracking.tracks.filter((track) => !resolvedTrackSettings[track.trackId]?.deleted),
    [resolvedTrackSettings, tracking.tracks],
  );
  const listedTrackIds = useMemo(() => listedTracks.map((track) => track.trackId), [listedTracks]);

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
    setIsSubjectListExpanded(false);
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
    setTrackSettings({});
    setPendingDeleteTrackId(undefined);
    setEditingTrackId(undefined);
    setIsBulkNaming(false);
    setSelectedTrackIds(new Set());
    setBulkLabelZh("");
    setConfirmAutoNumber(false);
  }

  function updateTrack(trackId: string, patch: Parameters<typeof updateUserTrackSettings>[2]) {
    setTrackSettings((current) => updateUserTrackSettings(
      createUserTrackSettings(tracking.tracks, current),
      trackId,
      patch,
    ));
  }

  function toggleBulkNaming() {
    const next = !isBulkNaming;
    setIsBulkNaming(next);
    setIsSubjectListExpanded(next);
    setSelectedTrackIds(new Set());
    setBulkLabelZh("");
    setConfirmAutoNumber(false);
    setEditingTrackId(undefined);
  }

  function toggleTrackSelection(trackId: string) {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function updateSelected(patch: Parameters<typeof updateManyUserTrackSettings>[2]) {
    setTrackSettings((current) => updateManyUserTrackSettings(
      createUserTrackSettings(tracking.tracks, current),
      [...selectedTrackIds],
      patch,
    ));
  }

  function focusNextBulkName(currentTrackId: string) {
    const nextId = nextTrackId(listedTrackIds, currentTrackId);
    if (!nextId) return;
    requestAnimationFrame(() => {
      const input = bulkNameInputRefs.current.get(nextId);
      input?.scrollIntoView({ block: "nearest" });
      input?.focus({ preventScroll: true });
      input?.select();
    });
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
        nextFrames.push({ time: times[index], detections: result.detections, inferenceMs: result.inferenceMs, appearanceMs: result.appearanceMs });
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
    <main className="flex h-dvh overflow-hidden flex-col bg-[#F7F7F5] text-[#171717]">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#E8E8E5] bg-white px-6 lg:px-8">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-1">
        <section className="flex h-full min-h-0 overflow-hidden items-center justify-center bg-[#ECECEA] p-6 lg:p-8">
          <div className="h-full min-h-0 w-full max-w-[1200px]">
            <VideoStage observations={visibleObservations} metadata={metadata} onTimeChange={setPlaybackTime} source={source} videoRef={videoRef} />
          </div>
        </section>
        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[#E8E8E5] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-base font-semibold">主体列表</h2>
              {isBulkNaming ? <span className="truncate text-xs text-[#288B87]">批量命名中</span> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-pressed={isBulkNaming}
                onClick={toggleBulkNaming}
                className="rounded-md px-2 py-1 text-xs text-[#288B87] transition-colors hover:bg-[#E8F8F7]"
              >
                {isBulkNaming ? "退出批量命名" : "批量命名"}
              </button>
              <button
                type="button"
                aria-expanded={isSubjectListExpanded}
                aria-label={isSubjectListExpanded ? "收起主体列表" : "展开主体列表"}
                onClick={() => setIsSubjectListExpanded((expanded) => !expanded)}
                className="rounded-md px-2 py-1 text-xs text-[#777777] transition-colors hover:bg-[#F1F1EF] hover:text-[#171717]"
              >
                {isSubjectListExpanded ? "收起" : "展开"}
              </button>
            </div>
          </div>
          {isBulkNaming && listedTracks.length > 0 ? (
            <div className="mt-3 shrink-0 rounded-lg border border-[#D9EFEE] bg-[#F3FBFA] p-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-auto text-[#777777]">已选 {selectedTrackIds.size} 个</span>
                <button type="button" onClick={() => setSelectedTrackIds(new Set(listedTrackIds))} className="rounded-md border border-[#D9EFEE] bg-white px-2 py-1">全选当前列表</button>
                <button type="button" onClick={() => setSelectedTrackIds(new Set())} className="rounded-md border border-[#D9EFEE] bg-white px-2 py-1">清空选择</button>
              </div>
              <div className="mt-2 flex gap-1.5">
                <input aria-label="统一中文名称" value={bulkLabelZh} onChange={(event) => setBulkLabelZh(event.target.value)} placeholder="统一中文名称" className="min-w-0 flex-1 rounded-md border border-[#D9EFEE] bg-white px-2 py-1.5 outline-none focus:border-[#6ED3CF]" />
                <button type="button" disabled={selectedTrackIds.size === 0 || bulkLabelZh.trim() === ""} onClick={() => updateSelected({ labelZh: bulkLabelZh.trim() })} className="rounded-md bg-[#6ED3CF] px-2 py-1.5 text-[#113B39] disabled:opacity-40">统一命名</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" disabled={selectedTrackIds.size === 0} onClick={() => updateSelected({ visible: true })} className="rounded-md border border-[#D9EFEE] bg-white px-2 py-1 disabled:opacity-40">批量显示</button>
                <button type="button" disabled={selectedTrackIds.size === 0} onClick={() => updateSelected({ visible: false })} className="rounded-md border border-[#D9EFEE] bg-white px-2 py-1 disabled:opacity-40">批量隐藏</button>
                <button type="button" onClick={() => {
                  if (confirmAutoNumber) {
                    setTrackSettings((current) => autoNumberUserTrackSettings(
                      listedTracks,
                      createUserTrackSettings(tracking.tracks, current),
                    ));
                    setConfirmAutoNumber(false);
                  } else {
                    setConfirmAutoNumber(true);
                  }
                }} className="rounded-md border border-[#D9EFEE] bg-white px-2 py-1 text-[#288B87]">
                  {confirmAutoNumber ? "确认自动编号" : "按类别自动编号"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-4 min-h-24 flex-1 overflow-hidden">
            {listedTracks.length > 0 ? (
              <ul className="h-full space-y-2 overflow-y-auto pr-1">
                {listedTracks.map((track, trackIndex) => {
                  const setting = resolvedTrackSettings[track.trackId];
                  const confirmingDelete = pendingDeleteTrackId === track.trackId;
                  const editing = editingTrackId === track.trackId;
                  const previousTrack = listedTracks[trackIndex - 1];
                  return (
                    <li
                      key={track.trackId}
                      className="rounded-lg border p-3 text-xs transition-colors"
                      style={{
                        backgroundColor: setting.visible ? "#FFFFFF" : "#ECECEA",
                        borderColor: setting.visible ? "#E8E8E5" : "#D8D8D4",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {isBulkNaming ? (
                          <label className="flex items-center gap-2 font-medium text-[#171717]">
                            <input type="checkbox" aria-label={`选择 ${setting.labelZh}`} checked={selectedTrackIds.has(track.trackId)} onChange={() => toggleTrackSelection(track.trackId)} className="accent-[#6ED3CF]" />
                            <span className={setting.visible ? "" : "text-[#777777]"}>{setting.labelZh}</span>
                          </label>
                        ) : <span className={`font-medium ${setting.visible ? "text-[#171717]" : "text-[#777777]"}`}>{setting.labelZh}</span>}
                        <span className="text-[#A3A3A3]">AI：{categoryLabel(track.category)} · {Math.round(track.confidence * 100)}%</span>
                      </div>
                      {isBulkNaming ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-end gap-1.5">
                            <label className="min-w-0 flex-1 text-[#777777]">
                              中文名称
                              <input
                                ref={(node) => { if (node) bulkNameInputRefs.current.set(track.trackId, node); else bulkNameInputRefs.current.delete(track.trackId); }}
                                aria-label={`${track.trackId} 中文名称`}
                                value={setting.labelZh}
                                onChange={(event) => updateTrack(track.trackId, { labelZh: event.target.value })}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    focusNextBulkName(track.trackId);
                                  }
                                }}
                                className="mt-1 w-full rounded-md border border-[#E8E8E5] bg-white px-2 py-1.5 text-[#171717] outline-none focus:border-[#6ED3CF]"
                              />
                            </label>
                            <button type="button" disabled={!previousTrack} onClick={() => {
                              if (!previousTrack) return;
                              setTrackSettings((current) => copyPreviousTrackName(
                                createUserTrackSettings(tracking.tracks, current),
                                previousTrack.trackId,
                                track.trackId,
                              ));
                            }} className="mb-px rounded-md border border-[#E8E8E5] bg-white px-2 py-1.5 text-[#777777] disabled:opacity-30">同上</button>
                          </div>
                          <label className="block text-[#777777]">
                            英文副标题（可选）
                            <input aria-label={`${track.trackId} 英文副标题`} value={setting.labelEn} onChange={(event) => updateTrack(track.trackId, { labelEn: event.target.value })} className="mt-1 w-full rounded-md border border-[#E8E8E5] bg-white px-2 py-1.5 text-[#171717] outline-none focus:border-[#6ED3CF]" />
                          </label>
                        </div>
                      ) : editing ? (
                        <div className="mt-2">
                          <label className="block text-[#777777]">
                            中文名称
                            <input aria-label={`${setting.labelZh} 中文名称`} value={setting.labelZh} onChange={(event) => updateTrack(track.trackId, { labelZh: event.target.value })} className="mt-1 w-full rounded-md border border-[#E8E8E5] px-2 py-1.5 text-[#171717] outline-none focus:border-[#6ED3CF]" />
                          </label>
                          <label className="mt-2 block text-[#777777]">
                            英文副标题（可选）
                            <input aria-label={`${setting.labelZh} 英文副标题`} value={setting.labelEn} onChange={(event) => updateTrack(track.trackId, { labelEn: event.target.value })} className="mt-1 w-full rounded-md border border-[#E8E8E5] px-2 py-1.5 text-[#171717] outline-none focus:border-[#6ED3CF]" />
                          </label>
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => updateTrack(track.trackId, { visible: !setting.visible })} className="rounded-md border border-[#E8E8E5] px-2 py-1.5">
                          {setting.visible ? "隐藏标签" : "显示标签"}
                        </button>
                        {isBulkNaming ? null : <button type="button" onClick={() => setEditingTrackId(editing ? undefined : track.trackId)} className="rounded-md border border-[#E8E8E5] px-2 py-1.5">{editing ? "完成编辑" : "编辑名称"}</button>}
                        <button type="button" onClick={() => {
                          if (confirmingDelete) {
                            updateTrack(track.trackId, { deleted: true });
                            setPendingDeleteTrackId(undefined);
                            setSelectedTrackIds((current) => {
                              const next = new Set(current);
                              next.delete(track.trackId);
                              return next;
                            });
                            if (editing) setEditingTrackId(undefined);
                          } else {
                            setPendingDeleteTrackId(track.trackId);
                          }
                        }} className="rounded-md border border-[#E8E8E5] px-2 py-1.5 text-[#B83232]">
                          {confirmingDelete ? "确认删除" : "删除主体"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="h-full rounded-xl border border-[#E8E8E5] bg-[#FAFAF8] px-4 py-4 text-left">
                <p className="text-sm text-[#777777]">{analysisStatus === "completed" ? "没有可显示的主体" : "尚未分析视频"}</p>
                <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">这里只显示模型真实检测并关联出的主体</p>
              </div>
            )}
          </div>
          {isSubjectListExpanded ? null : (
            <>
              <section className="mt-3 shrink-0 border-t border-[#E8E8E5] pt-3">
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
            </>
          )}
        </aside>
      </div>

      <section className="h-[116px] shrink-0 border-t border-[#E8E8E5] bg-white px-6 py-5 lg:px-8">
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
    <section className="mt-3 shrink-0 border-t border-[#E8E8E5] pt-3">
      <h3 className="text-sm font-medium">本地 AI 分析</h3>
      <p className="mt-2 text-xs leading-5 text-[#777777]">{statusText}</p>
      <button type="button" disabled={busy} onClick={() => onAnalyze("auto")} className="mt-2 w-full rounded-[10px] bg-[#6ED3CF] px-4 py-2.5 text-sm font-medium text-[#113B39] disabled:opacity-50">开始本地分析</button>
      <button type="button" disabled={busy} onClick={() => onAnalyze("wasm")} className="mt-1 w-full rounded-[10px] border border-[#E8E8E5] px-4 py-2 text-xs disabled:opacity-50">使用 WASM 兼容路径</button>
      {loadMetrics ? (
        <dl className="mt-2 grid grid-cols-[92px_1fr] gap-x-2 gap-y-2 text-xs">
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
