# Video Head Labels

一个完全在浏览器本地运行的视频主体检测与动态标签编辑器。视频和视频帧不会上传到服务器，也不会调用云端推理 API。

## 开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 模型与许可证

- 本项目使用 Ultralytics YOLOv8n 预训练模型进行浏览器本地目标检测。
- 微软 ONNX Runtime 示例提供模型的官方集成与导出来源；其生成脚本通过 Ultralytics 获取 `yolov8n.pt` 权重。
- Ultralytics YOLO 模型及相关代码默认采用 GNU Affero General Public License v3.0（AGPL-3.0）。
- 为遵守该许可证，本项目整体按 AGPL-3.0 开源。完整条款见 [LICENSE](LICENSE)。
- 模型的固定版本、准确下载地址、文件大小和 SHA256 记录在 `docs/benchmarks/detection-spike.md`。

模型权重的版权归其原权利人所有；使用者应继续遵守 Ultralytics 的许可证条款。

## 验证

```bash
npm test
npm run lint
npm run build
```
