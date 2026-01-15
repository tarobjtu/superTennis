# 网球检测 ML 模型

本目录包含用于训练和导出网球检测模型的脚本。

## 快速开始

### 1. 安装依赖

```bash
pip3 install ultralytics
```

### 2. 导出预训练模型 (推荐)

最快的方式是使用 YOLOv8n 预训练模型（COCO 数据集，包含 sports ball 类别）：

```bash
cd ml
python3 train_tennis_detector.py --export-only
```

这将在 `ml/exports/` 目录生成 CoreML 模型文件。

### 3. 添加模型到 Xcode 项目

导出完成后，将 `.mlpackage` 文件复制到 iOS 项目：

```bash
cp -r exports/*.mlpackage ../apps/mobile/ios/
```

然后在 Xcode 中将模型添加到项目资源。

## 自定义训练

如果需要更好的网球检测效果，可以使用自定义数据集训练：

### 使用 Roboflow 数据集

```bash
python3 train_tennis_detector.py --roboflow-key YOUR_API_KEY --epochs 100
```

### 使用本地数据集

```bash
python3 train_tennis_detector.py --data path/to/data.yaml --epochs 100
```

## 模型规格

| 属性 | 值 |
|------|-----|
| 基础模型 | YOLOv8n (Nano) |
| 输入尺寸 | 640x384 |
| 量化 | INT8 |
| NMS | 内置 |
| 目标类别 | sports ball (COCO #32) |

## 性能预期

| 设备 | 推理速度 | 功耗 |
|------|---------|------|
| iPhone 15 Pro | ~8ms | 低 (Neural Engine) |
| iPhone 13 | ~12ms | 低 (Neural Engine) |
| iPhone 11 | ~18ms | 中 (GPU) |

## 目录结构

```
ml/
├── train_tennis_detector.py  # 训练和导出脚本
├── exports/                   # 导出的模型文件
│   └── *.mlpackage           # CoreML 模型
├── datasets/                  # 训练数据集 (git ignored)
└── runs/                      # 训练运行记录 (git ignored)
```
