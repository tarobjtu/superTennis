# Changelog

所有重大变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中
- 真实图像处理（Native Module）
- 多摄像头支持
- 轨迹回放动画
- 落点热力图统计

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
| 0.2.0 | 2026-01-15 | AI 演示模式、国际化、CI/CD |
| 0.1.0 | 2026-01-14 | MVP 版本，核心功能完成 |

---

## 贡献者

- [@tarobjtu](https://github.com/tarobjtu) - 项目创建者
- Claude Code - AI 辅助开发
