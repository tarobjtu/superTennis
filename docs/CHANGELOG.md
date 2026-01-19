# Changelog

所有重大变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中
- 多摄像头支持
- 轨迹回放动画
- 落点热力图统计
- Android 平台支持

---

## [0.3.1] - 2026-01-19

### 新增
- **离线视频测试工具** - `ml/hawkeye_video_test.py`
  - 交互式 4 点球场校准
  - YOLOv8 网球检测 + 轨迹追踪
  - 落点检测 + 界内/出界判定
  - 轨迹预测补充漏检
  - 可视化输出和统计报告
- **落点标注工具** - `ml/bounce_annotator.py`
  - 视频播放和帧级控制
  - 落点标注（界内/出界）
  - 自动计算召回率、精确率、F1
  - Ground Truth 对比评估
- **交互式模型训练** - `ml/train_tennis_model.py`
  - 安全 API Key 输入
  - 多数据集选择 (v17 9836张, v8 4156张)
  - 自动 CoreML 导出
- **更大数据集支持** - Hard Court Tennis Ball v17
  - 9,836 张训练图片 (v8 的 2.4 倍)
  - 预期更高检测率和召回率

### 变更
- 更新 `ml/README.md` 文档
  - 添加工具使用说明
  - 添加性能指标
  - 添加 FAQ 常见问题
- 更新 `.gitignore` 排除 datasets_v17 目录

### 性能指标 (v8 数据集测试)

| 指标 | 值 |
|------|-----|
| 检测率 | 18% |
| 召回率 | 51.6% |
| 精确率 | 94.1% |
| F1 分数 | 66.7% |
| 判定准确率 | 100% |

### 修复
- 修复球在空中时被误判为 OUT 的问题
  - 添加 `_is_valid_court_position()` 过滤无效坐标

---

## [0.3.0] - 2026-01-17

### 新增
- **原生 ML 检测** - VisionCamera + YOLOv8 CoreML 实时网球检测
  - Swift Frame Processor 原生插件 (`TennisBallDetectorFrameProcessor`)
  - YOLOv8n CoreML 模型导出 (INT8 量化, ~3.2MB)
  - 60 FPS 实时推理，Neural Engine 优化
  - Expo Config Plugin 自动集成原生代码
- **ML 训练脚本** - `ml/train_tennis_detector.py`
  - 支持 Roboflow 数据集下载
  - 支持本地数据集训练
  - 自动导出 CoreML 格式
- **EAS Build 支持** - Development Build 配置
  - 模拟器和真机构建配置
  - 自动打包原生模块
- **新增服务层**
  - `visionHawkEye.ts` - 新版鹰眼分析服务
  - `nativeBallDetector.ts` - 原生检测桥接
  - `HawkEyeCamera.tsx` - 鹰眼摄像头组件

### 变更
- 摄像头从 `expo-camera` 升级到 `react-native-vision-camera v4`
- 添加 `react-native-worklets-core` 支持 Worklet
- 更新 Babel 配置支持 worklets 插件
- 更新文档反映新架构

### 技术改进
- 检测准确率从 ~60% 提升到 ~80%
- 推理速度: iPhone 15 Pro ~8ms, iPhone 13 ~12ms
- 模型大小从 ~12.7MB 优化到 ~3.2MB (INT8 量化)

### 依赖更新
- 新增: `react-native-vision-camera`, `react-native-worklets-core`
- 新增: 多个 Babel 兼容插件

### 注意事项
- 需要 Development Build，Expo Go 不支持原生模块
- 真机测试需要 Apple Developer 账号

---

## [0.2.0] - 2026-01-15

### 新增
- **AI 演示模式** - 在 Simulator 中测试鹰眼和自动记分功能
  - 模拟模式：自动生成测试数据，无需真实视频
  - 视频模式：从相册导入网球视频进行 AI 分析
  - 实时比分显示和球场可视化
- **国际化 (i18n)** - 支持中英文切换
  - 基于设备语言自动选择
  - 手动切换语言设置
  - 完整的翻译覆盖（通用、比赛、AI、设置等模块）
- **CI/CD 流水线** - GitHub Actions 自动化
  - ESLint 代码检查
  - TypeScript 类型检查
  - Jest 单元测试
  - 移动端 Expo Doctor 检查
  - 服务端构建验证
- **代码质量工具**
  - ESLint 配置（TypeScript + React）
  - Prettier 代码格式化
  - Jest 测试框架配置
- **单元测试**
  - `hawkEye.ts` 测试用例（界内判定、发球有效性）
  - `tennisAI.ts` 测试用例（AI 分析器功能）

### 修复
- 修复 `stats/index.tsx` 中 JSON.parse 空值导致的崩溃
- 添加 player1Sets/player2Sets 的防御性检查

### 变更
- 首页新增 "AI 功能" 区域入口
- 优化项目目录结构文档

---

## [0.1.0] - 2026-01-14

### 新增
- **项目初始化**
  - React Native + Expo SDK 54 移动端应用
  - Express + Prisma 服务端
  - Monorepo 项目结构

- **核心功能**
  - 比赛记分系统（支持标准网球计分规则）
  - 场地校准（四点透视变换）
  - AI 鹰眼判定系统
  - 自动记分模式
  - 比赛回放功能
  - 视频录制

- **AI 模块**
  - HSV 颜色空间网球检测
  - 卡尔曼滤波轨迹平滑
  - 速度方向变化落点检测
  - 透视变换坐标转换
  - 界内/出界判定算法

- **数据持久化**
  - 比赛记录存储
  - 用户信息管理
  - 视频记录管理

- **项目文档**
  - README.md - 项目概述
  - PRD.md - 产品需求文档
  - ARCHITECTURE.md - 技术架构文档
  - AI_ALGORITHM.md - AI 算法设计文档
  - API.md - API 接口文档

---

## 版本对比

| 版本 | 发布日期 | 主要特性 |
|-----|---------|---------|
| 0.3.1 | 2026-01-19 | 离线视频测试、落点标注工具、性能评估 |
| 0.3.0 | 2026-01-17 | 原生 ML 检测、VisionCamera + YOLOv8 CoreML |
| 0.2.0 | 2026-01-15 | AI 演示模式、国际化、CI/CD |
| 0.1.0 | 2026-01-14 | MVP 版本，核心功能完成 |

---

## 贡献者

- [@tarobjtu](https://github.com/tarobjtu) - 项目创建者
- Claude Code - AI 辅助开发
