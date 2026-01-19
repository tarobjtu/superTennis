#!/usr/bin/env python3
"""
网球检测模型训练脚本 (交互式)

功能:
1. 安全输入 Roboflow API Key
2. 下载网球数据集
3. 训练 YOLOv8 模型
4. 导出为 CoreML 格式
5. 自动测试新模型

使用方法:
    python train_tennis_model.py
"""

import getpass
import os
import sys
import shutil
from pathlib import Path


def check_dependencies():
    """检查依赖"""
    missing = []

    try:
        import ultralytics
        print(f"✓ ultralytics {ultralytics.__version__}")
    except ImportError:
        missing.append("ultralytics")

    try:
        import roboflow
        print(f"✓ roboflow")
    except ImportError:
        missing.append("roboflow")

    try:
        import cv2
        print(f"✓ opencv-python {cv2.__version__}")
    except ImportError:
        missing.append("opencv-python")

    if missing:
        print(f"\n缺少依赖: {', '.join(missing)}")
        print(f"请运行: pip install {' '.join(missing)}")
        sys.exit(1)

    print()


def get_api_key():
    """安全获取 API Key"""
    print("=" * 50)
    print("Roboflow API Key")
    print("=" * 50)
    print("请输入你的 Private API Key")
    print("(输入时不会显示在屏幕上)")
    print()

    api_key = getpass.getpass("API Key: ")

    if not api_key or len(api_key) < 10:
        print("错误: API Key 无效")
        sys.exit(1)

    return api_key


def select_dataset():
    """选择数据集"""
    datasets = [
        {
            "name": "Hard Court Tennis Ball (推荐)",
            "workspace": "tennistracking",
            "project": "hard-court-tennis-ball",
            "version": 8,
            "images": 4156,
        },
        {
            "name": "Tennis Ball Detection",
            "workspace": "tennisball-3eqxr",
            "project": "tennis-ball-detection-qaxae",
            "version": 1,
            "images": 492,
        },
        {
            "name": "Tennis Ball Detection (Nathan)",
            "workspace": "nathan-4tlqa",
            "project": "tennis-ball-detection-vksde",
            "version": 1,
            "images": 200,
        },
    ]

    print("=" * 50)
    print("选择数据集")
    print("=" * 50)

    for i, ds in enumerate(datasets, 1):
        print(f"  {i}. {ds['name']}")
        print(f"     图片数: {ds['images']}")
        print()

    while True:
        try:
            choice = input("请选择 (1-3) [默认 1]: ").strip()
            if choice == "":
                choice = 1
            else:
                choice = int(choice)

            if 1 <= choice <= len(datasets):
                return datasets[choice - 1]
            else:
                print("请输入 1-3 之间的数字")
        except ValueError:
            print("请输入有效数字")


def download_dataset(api_key: str, dataset: dict, output_dir: str = "datasets"):
    """下载数据集"""
    from roboflow import Roboflow

    print()
    print("=" * 50)
    print("下载数据集")
    print("=" * 50)
    print(f"数据集: {dataset['name']}")
    print(f"Workspace: {dataset['workspace']}")
    print(f"Project: {dataset['project']}")
    print(f"Version: {dataset['version']}")
    print()

    try:
        rf = Roboflow(api_key=api_key)
        project = rf.workspace(dataset['workspace']).project(dataset['project'])
        ds = project.version(dataset['version']).download("yolov8", location=output_dir)

        print(f"\n✓ 数据集已下载到: {ds.location}")
        return ds.location
    except Exception as e:
        print(f"\n错误: 下载失败 - {e}")
        print("\n可能的原因:")
        print("  1. API Key 无效")
        print("  2. 网络连接问题")
        print("  3. 数据集不存在或无权访问")
        sys.exit(1)


def train_model(data_yaml: str, epochs: int = 50, imgsz: int = 640, batch: int = 16):
    """训练模型"""
    from ultralytics import YOLO

    print()
    print("=" * 50)
    print("训练模型")
    print("=" * 50)
    print(f"数据集: {data_yaml}")
    print(f"Epochs: {epochs}")
    print(f"图像大小: {imgsz}")
    print(f"Batch: {batch}")
    print()

    # 检测设备
    device = "mps" if sys.platform == "darwin" else 0
    print(f"训练设备: {'Apple Metal (MPS)' if device == 'mps' else 'CUDA GPU'}")
    print()

    # 加载预训练模型
    model = YOLO("yolov8n.pt")

    # 训练
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project="runs/tennis",
        name="train",
        device=device,
        verbose=True,
        patience=10,  # 早停
        save=True,
        plots=True,
    )

    # 找到最佳模型
    best_model = Path("runs/tennis/train/weights/best.pt")
    if not best_model.exists():
        # 尝试其他可能的路径
        for p in Path("runs/tennis").rglob("best.pt"):
            best_model = p
            break

    print(f"\n✓ 训练完成!")
    print(f"  最佳模型: {best_model}")

    return str(best_model)


def export_coreml(model_path: str, output_dir: str = "exports"):
    """导出 CoreML 模型"""
    from ultralytics import YOLO

    print()
    print("=" * 50)
    print("导出 CoreML 模型")
    print("=" * 50)

    os.makedirs(output_dir, exist_ok=True)

    model = YOLO(model_path)

    # 导出
    export_path = model.export(
        format="coreml",
        imgsz=[640, 384],  # 16:9.6 比例
        nms=True,
        int8=True,
    )

    print(f"\n✓ CoreML 模型已导出: {export_path}")

    # 复制到 exports 目录
    output_file = Path(output_dir) / "tennis_ball_detector.mlpackage"
    if Path(export_path).exists():
        if output_file.exists():
            shutil.rmtree(output_file)
        shutil.copytree(export_path, output_file)
        print(f"  已复制到: {output_file}")

    return str(output_file)


def test_model(model_path: str, test_video: str = None):
    """测试模型"""
    from ultralytics import YOLO

    print()
    print("=" * 50)
    print("测试模型")
    print("=" * 50)

    model = YOLO(model_path)

    # 打印模型信息
    print(f"模型: {model_path}")
    print(f"类别: {model.names}")

    if test_video and os.path.exists(test_video):
        print(f"\n在视频上测试: {test_video}")
        results = model.predict(
            source=test_video,
            save=True,
            conf=0.3,
            show_labels=True,
            show_conf=True,
        )
        print(f"\n✓ 测试结果已保存到 runs/detect/predict/")


def main():
    print()
    print("=" * 50)
    print("网球检测模型训练工具")
    print("=" * 50)
    print()

    # 1. 检查依赖
    print("检查依赖...")
    check_dependencies()

    # 2. 获取 API Key
    api_key = get_api_key()

    # 3. 选择数据集
    dataset = select_dataset()

    # 4. 询问训练参数
    print()
    print("=" * 50)
    print("训练参数")
    print("=" * 50)

    epochs_input = input("训练轮数 (epochs) [默认 50]: ").strip()
    epochs = int(epochs_input) if epochs_input else 50

    batch_input = input("Batch 大小 [默认 16]: ").strip()
    batch = int(batch_input) if batch_input else 16

    # 5. 下载数据集
    dataset_path = download_dataset(api_key, dataset)
    data_yaml = str(Path(dataset_path) / "data.yaml")

    # 6. 训练
    model_path = train_model(data_yaml, epochs=epochs, batch=batch)

    # 7. 导出 CoreML
    coreml_path = export_coreml(model_path)

    # 8. 询问是否测试
    print()
    test_video = input("输入测试视频路径 (留空跳过): ").strip()
    if test_video:
        test_model(model_path, test_video)

    # 9. 完成
    print()
    print("=" * 50)
    print("训练完成!")
    print("=" * 50)
    print()
    print("生成的文件:")
    print(f"  - PyTorch 模型: {model_path}")
    print(f"  - CoreML 模型: {coreml_path}")
    print()
    print("下一步:")
    print("  1. 使用新模型测试视频:")
    print(f'     python hawkeye_video_test.py --video your_video.mp4 --model {model_path}')
    print()
    print("  2. 将 CoreML 模型集成到 iOS App:")
    print(f"     复制 {coreml_path} 到 apps/mobile/ios/")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n已取消")
        sys.exit(0)
