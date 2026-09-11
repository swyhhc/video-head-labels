# 多目标追踪与基础主体编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将逐帧检测关联为稳定主体，并让用户在本地修改名称、显示状态和删除状态。

**Architecture:** 纯 TypeScript Tracker 接收 `DetectionFrame[]`，使用类别约束、恒速位置预测、IoU 和中心距离构建匹配成本，再用小规模全局分配输出 `TrackedFrame[]` 与 `Track[]`。用户设置由独立 store 管理，React 只组合追踪结果与设置；Canvas 继续通过共享 `LabelRenderer` 绘制当前时间的主体。

**Tech Stack:** TypeScript、React 19、Canvas、Vitest、Next.js 16；不新增依赖。

**Spec:** `docs/superpowers/plans/2026-09-11-video-head-labels-design.md`

## Global Constraints

- 保持纯前端、浏览器本地处理，不增加后端或云端依赖。
- 不做 ReID、embedding、人工身份纠错、ffmpeg、导出或复杂时间轴。
- detection 原始数据不可承载用户编辑状态。
- 配置化 lost window，默认连续漏检 2 个抽样帧后结束。
- 单次最多维护 10 个主体。

---

### Task 1: Tracker 数据模型与关联算法

**Files:**
- Create: `src/features/tracking/types.ts`
- Create: `src/features/tracking/config.ts`
- Create: `src/features/tracking/tracker.ts`
- Test: `tests/tracking/tracker.test.ts`

**Interfaces:**
- Consumes: `trackDetectionFrames(frames: DetectionFrame[], config?: TrackerConfig)`
- Produces: `{ frames: TrackedFrame[]; tracks: Track[] }`

- [x] 写单主体连续运动、同类别多主体、交叉、漏检恢复、结束和新主体进入的失败测试。
- [x] 运行 `npm test -- tests/tracking/tracker.test.ts`，确认因模块不存在而失败。
- [x] 实现类别硬约束、恒速预测、IoU/中心距离综合成本和全局最小成本分配。
- [x] 实现 `new / active / temporarily_lost / ended` 生命周期和 2 帧 lost window。
- [x] 再次运行 Tracker 测试并确认通过。

### Task 2: 用户主体设置

**Files:**
- Create: `src/features/tracking/trackStore.ts`
- Test: `tests/tracking/trackStore.test.ts`

**Interfaces:**
- Consumes: `Track[]` 与 `Record<string, UserTrackSettings>`
- Produces: 默认设置、改名、显示切换、删除和可见主体筛选函数

- [x] 写中文名、英文副标题、隐藏/恢复和删除行为的失败测试。
- [x] 运行 `npm test -- tests/tracking/trackStore.test.ts`，确认失败原因正确。
- [x] 用不可变纯函数实现设置更新，保留 AI category。
- [x] 再次运行设置测试并确认通过。

### Task 3: 预览和右侧主体列表接线

**Files:**
- Modify: `src/components/editor/VideoWorkspace.tsx`
- Modify: `src/components/editor/VideoStage.tsx`
- Test: `tests/overlay/VideoStage.test.ts`
- Test: `tests/tracking/trackStore.test.ts`

**Interfaces:**
- Consumes: `TrackedObservation[]`、`Track[]`、`UserTrackSettings`
- Produces: 当前时间主体预览与完整主体编辑列表

- [x] 写用户名称立即进入 Renderer、隐藏/删除不渲染的失败测试。
- [x] 运行相关测试并确认失败原因正确。
- [x] 分析完成后生成 tracks；当前时间只读取对应 tracked frame。
- [x] Renderer 使用 trackId 作为稳定 key，并通过现有 `smoothPoint` 平滑标签锚点。
- [x] 右侧列表实现行内中英文改名、显示切换和二次确认删除。
- [x] 运行所有相关测试并确认通过。

### Task 4: 完整验证与交付

**Files:**
- Review: all files changed above

- [x] 运行 `npm test`。
- [x] 运行 `npm run lint`。
- [x] 运行 `npm run build`。
- [x] 用本地真实视频检查列表编辑与播放预览。
- [x] Review 查 Bug，然后按第一性原理删除不必要复杂度。
- [x] 单独提交 `feat: add local multi-object tracking and subject editing`。
- [x] 推送到 `origin/main` 并停止，不进入 Task 8。
