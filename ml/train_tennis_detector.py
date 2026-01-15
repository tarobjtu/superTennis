#!/usr/bin/env python3
"""
网球检测模型训练和导出脚本

功能:
1. 下载 Roboflow 网球数据集
2. 训练 YOLOv8n 模型
3. 导出为 CoreML 格式供 iOS 使用

使用方法:
    # 安装依赖
    pip install ultralytics roboflow

    # 方式1: 使用预训练模型直接导出 (推荐快速开始)
    python train_tennis_detector.py --export-only

    # 方式2: 从 Roboflow 下载数据集并训练
    python train_tennis_detector.py --roboflow-key YOUR_API_KEY

    # 方式3: 使用自定义数据集训练
    python train_tennis_detector.py --data path/to/data.yaml --epochs 100
"""

import argparse
import os
import sys
from pathlib import Path


def download_dataset(api_key: str, output_dir: str = "datasets") -> str:
    """
    从 Roboflow 下载网球数据集
    """
    try:
        from roboflow import Roboflow
    except ImportError:
        print("请安装 roboflow: pip install roboflow")
        sys.exit(1)

    print("正在从 Roboflow 下载数据集...")

    rf = Roboflow(api_key=api_key)

    # 使用 Roboflow 上的网球检测数据集
    # 你可以替换为其他数据集
    project = rf.workspace("tennisball-3eqxr").project("tennis-ball-detection-qaxae")
    dataset = project.version(1).download("yolov8", location=output_dir)

    print(f"数据集已下载到: {dataset.location}")
    return dataset.location


def train_model(
    data_yaml: str,
    epochs: int = 100,
    imgsz: int = 640,
    batch: int = 16,
    model_name: str = "yolov8n.pt",
    output_dir: str = "runs/detect",
) -> str:
    """
    训练 YOLOv8 模型
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("请安装 ultralytics: pip install ultralytics")
        sys.exit(1)

    print(f"开始训练模型...")
    print(f"  - 数据集: {data_yaml}")
    print(f"  - Epochs: {epochs}")
    print(f"  - 图像大小: {imgsz}")
    print(f"  - Batch: {batch}")

    # 加载预训练模型
    model = YOLO(model_name)

    # 训练
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=output_dir,
        name="tennis_ball",
        device="mps" if sys.platform == "darwin" else 0,  # macOS 使用 Metal
        verbose=True,
    )

    # 返回最佳模型路径
    best_model = Path(output_dir) / "tennis_ball" / "weights" / "best.pt"
    print(f"训练完成! 最佳模型: {best_model}")
    return str(best_model)


def export_coreml(
    model_path: str,
    output_dir: str = "exports",
    imgsz: int = 640,
    int8: bool = True,
    nms: bool = True,
) -> str:
    """
    将 PyTorch 模型导出为 CoreML 格式
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("请安装 ultralytics: pip install ultralytics")
        sys.exit(1)

    print(f"正在导出 CoreML 模型...")
    print(f"  - 输入模型: {model_path}")
    print(f"  - 图像大小: {imgsz}")
    print(f"  - INT8 量化: {int8}")
    print(f"  - NMS: {nms}")

    os.makedirs(output_dir, exist_ok=True)

    # 加载模型
    model = YOLO(model_path)

    # 导出为 CoreML
    # 注意: 对于 iPhone，推荐使用 640x384 或 640x480 的非正方形尺寸
    # 这样更接近相机的宽高比
    export_path = model.export(
        format="coreml",
        imgsz=[imgsz, int(imgsz * 0.6)],  # 640x384 比例
        nms=nms,
        int8=int8,
    )

    print(f"CoreML 模型已导出: {export_path}")

    # 复制到输出目录
    import shutil

    output_file = Path(output_dir) / "tennis_ball_detector.mlpackage"
    if Path(export_path).exists():
        if output_file.exists():
            shutil.rmtree(output_file)
        shutil.copytree(export_path, output_file)
        print(f"模型已复制到: {output_file}")

    return str(output_file)


def export_pretrained(output_dir: str = "exports") -> str:
    """
    导出预训练的 YOLOv8n 模型 (使用 COCO 的 sports ball 类别)
    这是最快的开始方式，不需要额外训练
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("请安装 ultralytics: pip install ultralytics")
        sys.exit(1)

    print("正在导出预训练 YOLOv8n 模型...")
    print("注意: 预训练模型使用 COCO 数据集，包含 'sports ball' 类别")
    print("对于更好的网球检测效果，建议使用自定义数据集训练")

    os.makedirs(output_dir, exist_ok=True)

    # 加载预训练模型
    model = YOLO("yolov8n.pt")

    # 导出 CoreML (优化后的尺寸)
    export_path = model.export(
        format="coreml",
        imgsz=[640, 384],  # 16:9.6 比例，接近手机相机
        nms=True,
        int8=True,
    )

    print(f"模型已导出: {export_path}")

    # 创建模型信息文件
    info_file = Path(output_dir) / "model_info.txt"
    with open(info_file, "w") as f:
        f.write("Tennis Ball Detector Model\n")
        f.write("=" * 40 + "\n\n")
        f.write("Base Model: YOLOv8n (Ultralytics)\n")
        f.write("Format: CoreML (.mlpackage)\n")
        f.write("Input Size: 640x384\n")
        f.write("Quantization: INT8\n")
        f.write("NMS: Included\n\n")
        f.write("Classes (COCO):\n")
        f.write("  - Class 32: sports ball\n")
        f.write("  - (Other 79 classes available but not needed)\n\n")
        f.write("Usage in Swift:\n")
        f.write("  1. Add .mlpackage to Xcode project\n")
        f.write("  2. Xcode will auto-generate Swift class\n")
        f.write("  3. Use Vision framework for inference\n")

    print(f"模型信息已保存: {info_file}")
    return export_path


def validate_model(model_path: str, test_images: str = None) -> None:
    """
    验证模型性能
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("请安装 ultralytics: pip install ultralytics")
        sys.exit(1)

    print(f"正在验证模型: {model_path}")

    model = YOLO(model_path)

    if test_images:
        # 在测试图像上运行推理
        results = model.predict(
            source=test_images, save=True, conf=0.5, show_labels=True, show_conf=True
        )
        print(f"推理结果已保存到 runs/detect/predict/")
    else:
        # 打印模型信息
        print("\n模型信息:")
        print(f"  - 类别数: {len(model.names)}")
        print(f"  - 类别名称: {model.names}")

        # COCO 数据集中 sports ball 的索引是 32
        if 32 in model.names:
            print(f"\n网球相关类别:")
            print(f"  - sports ball (索引 32)")


def main():
    parser = argparse.ArgumentParser(description="训练和导出网球检测模型")

    parser.add_argument(
        "--export-only",
        action="store_true",
        help="仅导出预训练模型 (不训练)",
    )

    parser.add_argument(
        "--roboflow-key",
        type=str,
        help="Roboflow API Key (用于下载数据集)",
    )

    parser.add_argument(
        "--data",
        type=str,
        help="自定义数据集 data.yaml 路径",
    )

    parser.add_argument(
        "--model",
        type=str,
        help="已训练的模型路径 (用于导出)",
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=100,
        help="训练轮数 (默认: 100)",
    )

    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="图像大小 (默认: 640)",
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=16,
        help="Batch 大小 (默认: 16)",
    )

    parser.add_argument(
        "--output",
        type=str,
        default="exports",
        help="输出目录 (默认: exports)",
    )

    parser.add_argument(
        "--validate",
        type=str,
        help="验证模型的测试图像目录",
    )

    args = parser.parse_args()

    # 模式1: 仅导出预训练模型
    if args.export_only:
        export_path = export_pretrained(args.output)
        print(f"\n✅ 预训练模型已导出: {export_path}")
        print("\n下一步:")
        print("  1. 将 .mlpackage 添加到 Xcode 项目")
        print("  2. 在 Swift Frame Processor 中使用 Vision 框架")
        return

    # 模式2: 从 Roboflow 下载数据集并训练
    if args.roboflow_key:
        dataset_path = download_dataset(args.roboflow_key)
        data_yaml = str(Path(dataset_path) / "data.yaml")
        model_path = train_model(
            data_yaml,
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
        )
        export_coreml(model_path, args.output)
        return

    # 模式3: 使用自定义数据集训练
    if args.data:
        model_path = train_model(
            args.data,
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
        )
        export_coreml(model_path, args.output)
        return

    # 模式4: 导出已有模型
    if args.model:
        export_coreml(args.model, args.output)

        if args.validate:
            validate_model(args.model, args.validate)
        return

    # 默认: 显示帮助
    parser.print_help()
    print("\n示例:")
    print("  # 快速开始 - 导出预训练模型")
    print("  python train_tennis_detector.py --export-only")
    print()
    print("  # 使用 Roboflow 数据集训练")
    print("  python train_tennis_detector.py --roboflow-key YOUR_KEY")
    print()
    print("  # 使用自定义数据集")
    print("  python train_tennis_detector.py --data path/to/data.yaml --epochs 50")


if __name__ == "__main__":
    main()
