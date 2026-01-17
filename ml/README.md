# 网球检测 ML 模型

本目录包含用于训练和导出网球检测模型的脚本，用于超级网球应用的 AI 鹰眼系统。

## 架构概述

```
┌─────────────────────────────────────────────────────────────────┐
│                       超级网球 AI 鹰眼系统                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │   摄像头     │───▶│  VisionCamera │───▶│ Frame Processor │    │
│  │  (60 FPS)   │    │   (原生)      │    │   (Worklet)     │    │
│  └─────────────┘    └──────────────┘    └────────┬────────┘    │
│                                                   │             │
│  ┌─────────────────────────────────────────────────▼──────────┐ │
│  │                    原生 Swift 插件                         │ │
│  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │ │
│  │  │ YOLOv8n    │───▶│ Vision框架   │───▶│ 检测结果     │  │ │
│  │  │ CoreML模型 │    │ (推理)       │    │ (坐标/置信度) │  │ │
│  │  └─────────────┘    └──────────────┘    └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                   │             │
│  ┌────────────────────────────────────────────────▼──────────┐ │
│  │                    TypeScript 层                          │ │
│  │  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │ │
│  │  │ visionHawkEye│───▶│ 轨迹追踪    │───▶│ 落地判定     │  │ │
│  │  │ Service     │    │ 速度计算     │    │ 出界检测     │  │ │
│  │  └─────────────┘    └──────────────┘    └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
pip3 install ultralytics coremltools
```

### 2. 导出预训练模型

```bash
cd ml
python3 train_tennis_detector.py --export-only
```

这将生成 `yolov8n.mlpackage` (约 3.2MB，INT8 量化)。

### 3. 复制模型到 iOS 项目

```bash
cp -r yolov8n.mlpackage ../apps/mobile/ios/TennisBallDetector/
```

模型会通过 Expo Config Plugin 自动添加到 Xcode 项目。

### 4. 构建 Development Build

```bash
cd ../apps/mobile
npx eas-cli build --platform ios --profile development
```

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| ML 模型 | YOLOv8n + CoreML | 轻量级目标检测 |
| 摄像头 | react-native-vision-camera v4 | 高性能原生摄像头 |
| 帧处理 | react-native-worklets-core | JS 线程外运行 |
| 原生桥接 | Swift Frame Processor | Vision 框架推理 |
| 构建系统 | EAS Build | 原生模块打包 |

## 模型规格

| 属性 | 值 |
|------|-----|
| 基础模型 | YOLOv8n (Nano) |
| 输入尺寸 | 640x384 |
| 量化 | INT8 (Neural Engine 优化) |
| NMS | 内置 |
| 目标类别 | sports ball (COCO #32) |
| 模型大小 | ~3.2 MB |

## 性能预期

| 设备 | 推理速度 | 功耗 |
|------|---------|------|
| iPhone 15 Pro | ~8ms | 低 (Neural Engine) |
| iPhone 13 | ~12ms | 低 (Neural Engine) |
| iPhone 11 | ~18ms | 中 (GPU) |

## 自定义训练

如需更好的网球检测效果，可使用自定义数据集：

### 使用 Roboflow 数据集

```bash
python3 train_tennis_detector.py --roboflow-key YOUR_API_KEY --epochs 100
```

### 使用本地数据集

```bash
python3 train_tennis_detector.py --data path/to/data.yaml --epochs 100
```

## 目录结构

```
ml/
├── train_tennis_detector.py  # 训练和导出脚本
├── yolov8n.mlpackage/        # 导出的 CoreML 模型
├── exports/                   # 导出信息
│   └── model_info.txt        # 模型元数据
├── datasets/                  # 训练数据集 (git ignored)
└── runs/                      # 训练运行记录 (git ignored)

apps/mobile/
├── ios/TennisBallDetector/
│   ├── TennisBallDetectorFrameProcessor.swift  # Swift 帧处理器
│   ├── TennisBallDetectorFrameProcessor.m      # ObjC 注册
│   └── yolov8n.mlpackage/                      # CoreML 模型
├── plugins/
│   └── withTennisBallDetector.js               # Expo Config Plugin
├── src/
│   ├── components/
│   │   └── HawkEyeCamera.tsx                   # 鹰眼摄像头组件
│   └── services/
│       ├── nativeBallDetector.ts               # 原生检测桥接
│       └── visionHawkEye.ts                    # 鹰眼分析服务
└── eas.json                                    # EAS 构建配置
```

## 注意事项

1. **Development Build 必需**：原生 ML 检测需要 Development Build，Expo Go 中会回退到模拟模式
2. **真机测试**：模拟器没有真实摄像头，需在真机上测试完整功能
3. **Babel 插件**：react-native-worklets-core 需要额外的 Babel 插件，已在 devDependencies 中配置
