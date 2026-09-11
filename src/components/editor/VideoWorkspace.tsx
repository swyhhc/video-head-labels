"use client";

import { useEffect, useState } from "react";

import { createVideoSource } from "../../features/media/createVideoSource";
import type { VideoSource } from "../../features/media/types";
import { VideoDropzone } from "./VideoDropzone";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VideoWorkspace() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.objectUrl);
    };
  }, [source]);

  function loadFile(file: File) {
    try {
      setSource(createVideoSource(file));
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取这个视频");
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
          <button type="button" className="rounded-[10px] border border-[#E8E8E5] bg-white px-4 py-2.5 text-sm transition-colors hover:bg-[#F1F1EF]" onClick={() => setSource(null)}>重新上传</button>
          <button type="button" disabled className="rounded-[10px] bg-[#6ED3CF] px-4 py-2.5 text-sm font-medium text-[#113B39] opacity-50">导出视频</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-[420px] items-center justify-center bg-[#ECECEA] p-6 lg:p-8">
          <video className="max-h-[calc(100vh-250px)] max-w-full rounded-xl bg-black object-contain" src={source.objectUrl} controls playsInline />
        </section>
        <aside className="border-l border-[#E8E8E5] bg-white p-6">
          <h2 className="text-base font-semibold">主体</h2>
          <div className="mt-6 rounded-xl border border-[#E8E8E5] bg-[#FAFAF8] px-4 py-8 text-center">
            <p className="text-sm text-[#777777]">尚未分析视频</p>
            <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">主体会在本地分析完成后显示在这里</p>
          </div>
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
