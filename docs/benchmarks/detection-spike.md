# 浏览器本地目标检测 Spike

记录日期：2026-09-11

## 模型来源与授权

- 模型系列：Ultralytics YOLOv8n，COCO 80 类目标检测。
- 权重授权：Ultralytics 明确说明其训练模型默认采用 AGPL-3.0；本项目整体采用 AGPL-3.0。
- 微软原始文件：`yolov8n_with_pre_post_processing.onnx`。
- 固定版本：Microsoft `onnxruntime-inference-examples` commit `4178e37dd726b8435eb52f3af9e6384c7b2680e8`（该文件首次提交版本，2023-05-17）。
- 固定下载地址：<https://raw.githubusercontent.com/microsoft/onnxruntime-inference-examples/4178e37dd726b8435eb52f3af9e6384c7b2680e8/mobile/examples/object_detection/android/app/src/main/res/raw/yolov8n_with_pre_post_processing.onnx>
- 微软原始文件：12,848,231 字节；SHA256 `09891302b98beff8ed17a94a9f6b3c5d6ff2297c5c8192c97041e7c9796da89a`。
- 微软记录的生成脚本：`onnxruntime-extensions` commit `64f20828ce0291394886e277c23529cd1d11320d` 的 `tutorials/yolo_e2e.py`。脚本调用 `ultralytics.YOLO("yolov8n.pt")` 获取预训练权重，再导出 ONNX。
- 上游没有在模型文件中记录当时的 Ultralytics Python 包版本，因此不能可靠声称更具体的软件版本；这里用不可变的微软提交和原始文件 SHA256 作为模型版本标识。

微软文件含移动端 `com.microsoft.extensions:DecodeImage`、`DrawBoundingBoxes` 和 `EncodeImage`，ONNX Runtime Web 无法注册这些扩展算子。项目中的 `scripts/extract-browser-yolov8n.py` 仅删除这些图像前后处理节点，保留原始 YOLO 权重和推理图；没有重新训练、量化或更换模型来源。

浏览器模型：`public/models/yolov8n.onnx`，12,822,144 字节（12.23 MiB），SHA256 `e2334296256ef5b5914c5fd05f5c4ba7dfac823c3b019d578e95e03855e19fa7`。

## 单帧实测

环境：Apple arm64、macOS 26.5.1、Google Chrome 153.0.8010.36。真实输入为本地 10 秒、1920 × 1080、H.264 视频第 3 秒画面；画面包含车辆和树木。没有使用假帧或预制检测结果。

| 路径 | 模型下载 | 初始化 | 首帧推理 | 后续单帧 | JS 堆观察 | 结果 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| WebGPU | 66 ms | 715 ms | 84 ms | 27 ms | +10.2 MB | 成功，3 个真实检测 |
| WASM | 53 ms | 21 ms | 192 ms | 174 ms | -3.8 MB | 成功，3 个真实检测 |

数字是一次本机开发环境实测，只用于判断可行性，不是跨设备性能承诺。Chrome 的 `performance.memory` 只观察 JavaScript 堆，不能代表 GPU 内存、WASM 线性内存或浏览器总内存；负增量表示采样间发生垃圾回收。

## 结论与限制

- WebGPU 和 WASM 都完成了真实模型推理；自动模式优先 WebGPU，初始化失败时再尝试 WASM。
- 当前 UI 显示实际后端，而不是仅显示用户偏好。
- 原始微软移动端包装模型不能直接用于浏览器；该失败已明确保留在此记录中。
- Task 5 只验证当前真实视频帧，不处理整段视频，不包含 Tracking、ReID、ffmpeg 或云端 API。
