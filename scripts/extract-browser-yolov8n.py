"""Extract the browser-compatible YOLOv8n core graph from Microsoft's model.

Requires onnx==1.16.2. The source model is pinned and documented in
docs/benchmarks/detection-spike.md. This removes Microsoft Extensions image
pre/post-processing nodes; it does not retrain or alter the YOLO weights.
"""

from pathlib import Path

import onnx
from onnx import TensorProto, helper


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/models/yolov8n-with-pre-post-processing.onnx"
TARGET = ROOT / "public/models/yolov8n.onnx"


def main() -> None:
    model = onnx.load(SOURCE)
    core_nodes = list(model.graph.node[36:297])
    if core_nodes[0].name != "/model.0/conv/Conv" or core_nodes[-1].output[0] != "output0":
        raise RuntimeError("The pinned Microsoft graph layout changed; refusing to guess boundaries")

    core_nodes[0].input[0] = "images"
    graph = helper.make_graph(
        core_nodes,
        "Ultralytics YOLOv8n browser core extracted from Microsoft ONNX Runtime example",
        [helper.make_tensor_value_info("images", TensorProto.FLOAT, [1, 3, 640, 640])],
        [helper.make_tensor_value_info("output0", TensorProto.FLOAT, [1, 84, 8400])],
        initializer=list(model.graph.initializer),
    )
    extracted = helper.make_model(
        graph,
        producer_name=model.producer_name,
        producer_version=model.producer_version,
        opset_imports=[item for item in model.opset_import if item.domain == ""],
        ir_version=model.ir_version,
    )
    extracted.metadata_props.extend(model.metadata_props)
    onnx.checker.check_model(extracted)
    onnx.save(extracted, TARGET)


if __name__ == "__main__":
    main()
