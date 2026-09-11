# 视频头顶加字幕 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在桌面浏览器本地完成“导入短视频 → 本地检测/追踪 → 动态标签编辑 → 人工纠错 → 本地导出 MP4”的完整闭环。

**Architecture:** Next.js + React + TypeScript 负责 UI；HTMLVideoElement 播放视频，Canvas 负责 Overlay；ONNX Runtime Web 在浏览器本地推理，优先 WebGPU、回退 WASM；多目标追踪和 ReID 独立封装；ffmpeg.wasm 负责必要转码与最终导出。V1 无后端、无云端推理。

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Canvas, Web Worker, ONNX Runtime Web, ffmpeg.wasm, Vitest

**Spec:** `docs/superpowers/specs/2026-09-11-video-head-labels-design.md`

## Global Constraints
- V1 不做后端、不做云端推理，视频不上传服务器。
- 桌面优先，但所有关键操作必须可通过点击/触控完成。
- 推荐 ≤15 秒，目标支持 ≤30 秒；≤1080p、≤30fps。
- 推荐 ≤50MB，初始硬上限 100MB；阈值全部配置化。
- MP4/MOV；H.264 优先；HEVC 必要时本地转码。
- 最多 10 个 Track，推荐 1–6 个主体。
- AI 错误必须有人工作为兜底。
- 预览和导出必须共享同一套 Renderer。

---

### Task 1：基础编辑器 + 本地视频导入
**Files:** `src/app/page.tsx`, `src/components/editor/VideoWorkspace.tsx`, `VideoDropzone.tsx`, `src/features/media/{config,types,createVideoSource}.ts`, `tests/media/createVideoSource.test.ts`

- [ ] 配置 Vitest，并先写文件类型/大小限制的失败测试。
- [ ] 实现统一 `VIDEO_LIMITS` 与 `createVideoSource(file)`。
- [ ] 做拖拽/点击上传 MP4、MOV。
- [ ] 显示文件名、大小和本地 `<video>` 预览。
- [ ] 跑 test、lint、build。
- [ ] Commit: `feat: add local video import shell`

**验收：** 能导入并预览本地视频；错误提示明确；视频不离开浏览器。

---

### Task 2：视频元信息与编码检测
**Files:** `src/features/media/inspectVideo.ts`, `src/features/media/types.ts`, `tests/media/inspectVideo.test.ts`

- [ ] 提取时长、宽高、容器、可检测时的 codec、兼容状态。
- [ ] codec 不确定时必须返回 unknown，不猜。
- [ ] UI 展示元信息和限制提示。
- [ ] Commit: `feat: inspect local video metadata`

**验收：** H.264 可直接继续；HEVC 可被标记为可能需要转码。

---

### Task 3：Canvas Overlay 基础
**Files:** `VideoStage.tsx`, `src/features/overlay/{types,canvasCoordinates}.ts`

- [ ] 先测试视频坐标 ↔ 屏幕坐标转换。
- [ ] `<video>` 上叠加严格对齐的 Canvas。
- [ ] 用一个临时固定标签验证 resize 后仍对齐。
- [ ] Commit: `feat: add canvas overlay stage`

---

### Task 4：共享标签 Renderer
**Files:** `LabelRenderer.ts`, `labelLayout.ts`, `labelSmoothing.ts`

- [ ] 实现经典/极简/数据感三种预设。
- [ ] 中文主标题 + 英文副标题 + 细引导线。
- [ ] 实现标签平滑和基础避让。
- [ ] Renderer 不依赖 React，供预览和导出共用。
- [ ] Commit: `feat: add shared label renderer`

---

### Task 5：浏览器本地目标检测 Spike
**Files:** `src/features/detection/{types,detector,browserDetector}.ts`, `src/workers/detection.worker.ts`, `docs/benchmarks/detection-spike.md`

- [ ] 用 ONNX Runtime Web 测一款轻量 YOLO ONNX。
- [ ] 优先 WebGPU，确认 WASM fallback。
- [ ] 记录模型大小、初始化时间、单帧延迟。
- [ ] 暂时不要做整段视频。
- [ ] Commit: `spike: validate browser object detection`

**验收：** 本地成功检测常见主体，不调用云端 API。

---

### Task 6：抽帧检测流水线
- [ ] 配置化检测间隔。
- [ ] Worker 中处理推理，UI 显示进度。
- [ ] 检测结果统一使用原视频坐标。
- [ ] Commit: `feat: add sampled video detection pipeline`

---

### Task 7：多目标 Tracker
**Files:** `src/features/tracking/{types,tracker,trackStore}.ts`

- [ ] 测试正常运动、短暂漏检、两主体交叉。
- [ ] 第一阶段实现 motion + IoU 关联和丢失宽限期。
- [ ] Track 状态：new / active / temporarily_lost / reidentified / ended。
- [ ] Commit: `feat: add local multi-object tracking`

---

### Task 8：ReID 增强
**Files:** `src/features/tracking/reid.ts`, `docs/benchmarks/reid-spike.md`

- [ ] benchmark 轻量本地 embedding 模型。
- [ ] 仅在关联模糊时使用 ReID，不逐帧重算。
- [ ] ReID 必须可配置关闭。
- [ ] Commit: `feat: add appearance-assisted reidentification`

---

### Task 9：主体列表与改名
- [ ] 主体列表与视频选中双向联动。
- [ ] 中文名、英文名可编辑。
- [ ] 显示/隐藏可切换。
- [ ] 用户名称与 AI category 永远分离。
- [ ] Commit: `feat: add subject label editing`

---

### Task 10：时间轴与人工纠错
- [ ] 时间轴显示 Track 存在区间。
- [ ] 实现“从这里开始跟这个”重新绑定。
- [ ] 实现身份串线修正。
- [ ] 人工修正优先于 AI 自动结果。
- [ ] Commit: `feat: add timeline and manual corrections`

---

### Task 11：HEVC 本地兼容/转码
- [ ] 先实现是否需要转码的判断逻辑。
- [ ] ffmpeg.wasm 懒加载，不影响首页。
- [ ] H.264 不做无意义转码。
- [ ] HEVC 必要时转 H.264，并显示进度。
- [ ] Commit: `feat: add local hevc compatibility path`

---

### Task 12：本地 MP4 导出
- [ ] 逐帧读取视频时间。
- [ ] 使用与预览相同的 `LabelRenderer` 合成。
- [ ] ffmpeg.wasm 编码 MP4。
- [ ] 导出只包含原视频 + 最终标签，不含调试框/ID/轨迹。
- [ ] Commit: `feat: export labeled video locally`

---

### Task 13：性能压测并锁最终限制
测试：
- 10s / 15s / 30s
- H.264 / HEVC
- 1 / 5 / 10 个主体

记录：初始化、分析、转码、导出时间、内存、崩溃、ID switch。

根据实测只修改统一配置，不把新限制散落到组件。

Commit: `perf: lock v1 local video limits`

---

### Task 14：V1 Release Gate
- [ ] unit tests
- [ ] lint
- [ ] production build
- [ ] H.264 happy path
- [ ] HEVC fallback
- [ ] 5 主体追踪
- [ ] 交叉/遮挡
- [ ] 改名/隐藏/重新绑定
- [ ] MP4 导出
- [ ] 网络面板确认没有视频上传
- [ ] 关键操作不依赖 hover

**完成标准：** 本地导入 → 本地检测 → 多目标追踪 → 人工纠错 → 动态标签 → 本地导出整条链跑通。
