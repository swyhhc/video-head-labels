# 整段视频抽帧检测实测

记录日期：2026-09-11

## 配置

- 输入：本地 10 秒、1920 × 1080、H.264 真实视频。
- 抽帧间隔：0.5 秒，来自 `DETECTION_CONFIG.sampleIntervalSeconds`。
- 抽样：21 帧。
- 推理位置：Web Worker。主线程只负责视频 seek、创建 `ImageBitmap`、更新真实进度和渲染结果。
- 模型与环境：见 `detection-spike.md`。

## 结果

| Worker 路径 | 完整分析 | 纯推理 | 真实检测 | 主线程 JS 堆变化 | 最大画面更新间隔 |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebGPU | 2.5 秒 | 539 ms | 16 个 / 21 帧 | +0.69 MB | 60.3 ms |
| WASM 兼容路径 | 5.7 秒 | 3.8 秒 | 16 个 / 21 帧 | +0.79 MB | 33.3 ms |

两条路径均在 Worker 中完成，没有主线程推理回退，也没有页面错误。分析期间进度持续更新；本次设备上未观察到明显卡死。最大画面更新间隔是一次开发环境观察，不代表所有设备。

浏览器没有提供可靠的 Worker WASM 线性内存或 WebGPU 显存读数，因此这里只记录主线程 `performance.memory.usedJSHeapSize`。该数字不能代表浏览器总内存；GPU/Worker 总内存状态记为不可获得，而不是估算。

## 结果语义

- 所有框均在 Worker 中由模型原始输出换算为原视频像素坐标。
- `LabelRenderer` 再把原视频坐标换为当前屏幕坐标。
- `detectionId` 仅是单个抽样帧的渲染键。相邻帧即使检测到同一对象，也保留为独立 detection，不代表 Track ID。
- 当前阶段不包含 Tracking、ReID、ffmpeg、导出或云端 API。
