"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

interface VideoDropzoneProps {
  error?: string;
  onFile: (file: File) => void;
}

export function VideoDropzone({ error, onFile }: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function selectFirstFile(files: FileList | null) {
    const file = files?.item(0);
    if (file) onFile(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectFirstFile(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFirstFile(event.dataTransfer.files);
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] px-5 py-8 text-[#171717] sm:px-8">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-[620px] text-center">
          <div className="mb-9 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DDE9E7] bg-white text-[#319D99]">
            <UploadIcon />
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.03em]">视频头顶加字幕</h1>
          <p className="mx-auto mt-4 max-w-[420px] text-lg leading-8 text-[#777777]">
            给视频里的任何东西
            <br />
            加一个会跟着它走的名字。
          </p>

          <div
            className={`mt-10 rounded-[20px] border bg-white p-3 transition-colors duration-200 ${isDragging ? "border-[#6ED3CF] bg-[#F6FCFB]" : "border-[#E8E8E5]"}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-[#FAFAF8] px-6 py-10">
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#6ED3CF] px-5 py-3 text-sm font-medium text-[#113B39] transition-colors duration-200 hover:bg-[#63C5C1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ED3CF]"
                onClick={() => inputRef.current?.click()}
              >
                <UploadIcon />
                上传视频
              </button>
              <p className="mt-5 text-sm text-[#777777]">或把视频拖到这里</p>
              <p className="mt-2 text-xs text-[#A3A3A3]">MP4 / MOV · 推荐 15 秒以内 · 最高 1080p</p>
              <input ref={inputRef} className="sr-only" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" onChange={handleChange} />
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-[#D94A4A]" role="alert">{error}</p> : null}
          <p className="mt-7 inline-flex items-center gap-2 text-sm text-[#777777]">
            <ShieldIcon />
            视频仅在你的设备上处理，不会上传服务器
          </p>
        </section>
      </main>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-[#319D99]" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3l7 3v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3Z" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
