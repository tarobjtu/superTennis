# SuperTennis ML - AI 鹰眼系统

本目录包含 SuperTennis 应用的 AI 鹰眼系统的机器学习组件，用于网球检测、轨迹追踪和落点判定。

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

## 工具列表

| 工具 | 用途 | 文件 |
|------|------|------|
| **鹰眼视频测试** | 在视频上测试球场校准和落点检测 | `hawkeye_video_test.py` |
| **落点标注** | 人工标注落点用于计算召回率 | `bounce_annotator.py` |
| **模型训练** | 使用 Roboflow 数据集训练 YOLOv8 | `train_tennis_model.py` |
| **模型导出** | 导出预训练模型到 CoreML | `train_tennis_detector.py` |

## 快速开始

### 1. 安装依赖

```bash
cd ml
pip3 install -r requirements.txt
```

### 2. 测试视频 (鹰眼分析)

```bash
# 使用预训练 YOLOv8n 模型
python3 hawkeye_video_test.py --video path/to/tennis_video.mp4

# 使用自定义训练的模型
python3 hawkeye_video_test.py --video video.mp4 --model runs/detect/train/weights/best.pt

# 使用已有校准数据
python3 hawkeye_video_test.py --video video.mp4 --calibration calibration.json

# 仅校准（不处理视频）
python3 hawkeye_video_test.py --video video.mp4 --calibrate-only
```

校准时需依次点击球场的 4 个角落:
1. **远端左角** (Far-Left) - 离摄像头最远的左角
2. **远端右角** (Far-Right) - 离摄像头最远的右角
3. **近端右角** (Near-Right) - 离摄像头最近的右角
4. **近端左角** (Near-Left) - 离摄像头最近的左角

### 3. 标注落点 (评估召回率)

```bash
python3 bounce_annotator.py --video path/to/video.mp4
```

操作快捷键:
- `空格` - 暂停/继续
- `I` - 标记界内落点
- `O` - 标记出界落点
- `B` - 标记落点(未分类)
- `,/.` - 前后跳 1 帧
- `←/→` - 前后跳 1 秒
- `S` - 保存标注
- `R` - 生成评估报告

### 4. 训练自定义模型

```bash
# 交互式训练
python3 train_tennis_model.py

# 需要 Roboflow API Key (在 https://roboflow.com 注册)
```

可用数据集:
| 数据集 | 图片数 | 说明 |
|--------|--------|------|
| Hard Court Tennis Ball v17 | 9,836 | 推荐，最大 |
| Hard Court Tennis Ball v8 | 4,156 | 中等 |
| Tennis Ball Detection | 492 | 小型 |

## 模型规格

### YOLOv8n (预训练)

| 属性 | 值 |
|------|-----|
| 基础模型 | YOLOv8n (Nano) |
| 输入尺寸 | 640x384 |
| 量化 | INT8 (Neural Engine 优化) |
| NMS | 内置 |
| 目标类别 | sports ball (COCO #32) |
| 模型大小 | ~3.2 MB |

### 自定义训练模型

| 属性 | 值 |
|------|-----|
| 基础模型 | YOLOv8n (Nano) |
| 目标类别 | tennis-ball (索引 0) |
| 训练数据 | Roboflow 硬地网球数据集 |
| 检测率 | 12-18% (相比预训练 2-3%) |

## 性能指标

### 检测性能 (v8 数据集, 4156 图片)

| 指标 | 值 |
|------|-----|
| 检测率 | 18% |
| 召回率 | 51.6% |
| 精确率 | 94.1% |
| F1 分数 | 66.7% |
| 判定准确率 | 100% |

### 推理速度

| 设备 | 推理速度 | 功耗 |
|------|---------|------|
| iPhone 15 Pro | ~8ms | 低 (Neural Engine) |
| iPhone 13 | ~12ms | 低 (Neural Engine) |
| iPhone 11 | ~18ms | 中 (GPU) |
| Mac M3 Pro | ~27 fps | - |

## 目录结构

```
ml/
├── README.md                 # 本文件
├── requirements.txt          # Python 依赖
├── hawkeye_video_test.py     # 鹰眼视频测试工具
├── bounce_annotator.py       # 落点标注工具
├── train_tennis_model.py     # 模型训练脚本 (交互式)
├── train_tennis_detector.py  # 模型导出脚本
├── yolov8n.pt                # 预训练 YOLOv8n 权重
├── yolov8n.mlpackage/        # CoreML 模型 (预训练)
├── datasets/                 # 训练数据集 (git ignored)
├── datasets_v17/             # v17 数据集 (git ignored)
├── exports/                  # 导出的模型
│   └── tennis_ball_detector.mlpackage
└── runs/                     # 训练运行记录 (git ignored)
    ├── tennis/               # v8 数据集训练
    └── tennis_v17/           # v17 数据集训练
```

## iOS 集成

### 1. 导出 CoreML 模型

```bash
# 使用预训练模型
python3 train_tennis_detector.py --export-only

# 或使用自定义训练的模型
python3 -c "
from ultralytics import YOLO
model = YOLO('runs/detect/train/weights/best.pt')
model.export(format='coreml', imgsz=[640, 384], nms=True, int8=True)
"
```

### 2. 复制模型到 iOS 项目

```bash
cp -r exports/tennis_ball_detector.mlpackage ../apps/mobile/ios/TennisBallDetector/
```

模型会通过 Expo Config Plugin 自动添加到 Xcode 项目。

### 3. 构建 Development Build

```bash
cd ../apps/mobile
npx eas-cli build --platform ios --profile development
```

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| ML 模型 | YOLOv8n + CoreML | 轻量级目标检测 |
| 数据集 | Roboflow | 云端数据管理 |
| 训练加速 | Apple Metal (MPS) | Mac GPU 加速 |
| 摄像头 | react-native-vision-camera v4 | 高性能原生摄像头 |
| 帧处理 | react-native-worklets-core | JS 线程外运行 |
| 原生桥接 | Swift Frame Processor | Vision 框架推理 |
| 构建系统 | EAS Build | 原生模块打包 |

## 常见问题

### Q: 检测率太低怎么办？

1. **使用更大的数据集训练**: v17 数据集 (9836 图片) 比 v8 (4156 图片) 效果更好
2. **降低置信度阈值**: 使用 `--confidence 0.15` 参数
3. **确保校准正确**: 按正确顺序点击 4 个角落

### Q: 球在空中时被误判为 OUT？

这是因为空中的球位置超出了校准区域。已通过 `_is_valid_court_position()` 函数过滤，只有在有效球场区域内的落点才会被标记。

### Q: 如何提高召回率？

1. 使用轨迹预测功能 (已内置)
2. 使用更多数据训练模型
3. 调整落点检测参数 (bounce_cooldown, min_change)

## 注意事项

1. **Development Build 必需**: 原生 ML 检测需要 Development Build，Expo Go 中会回退到模拟模式
2. **真机测试**: 模拟器没有真实摄像头，需在真机上测试完整功能
3. **数据集许可**: Roboflow 数据集使用 CC BY 4.0 许可证
4. **API Key 安全**: 不要将 Roboflow API Key 提交到版本控制

## 相关文档

- [Ultralytics YOLOv8 文档](https://docs.ultralytics.com/)
- [Roboflow 文档](https://docs.roboflow.com/)
- [Apple CoreML 文档](https://developer.apple.com/documentation/coreml)
- [VisionCamera 文档](https://react-native-vision-camera.com/)
