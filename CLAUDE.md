# CLAUDE.md

> 这是一个供 Claude Code 使用的项目上下文文件，帮助 AI 快速理解项目并高效协作。

## 项目概述

**SuperTennis** - AI 驱动的网球比赛记分与鹰眼判定系统。

核心功能：
- 智能记分（手动 + AI 自动）
- 鹰眼系统（YOLOv8 CoreML 实时网球检测 + 落点判定）
- 场地校准（四点透视变换）
- 比赛回放与视频录制
- 俱乐部、好友、排行榜社交功能

## 快速启动

```bash
# 启动后端服务 (端口 3001)
npm run dev:server

# 启动移动端 (Expo + iOS 模拟器)
npm run dev:mobile

# 同时启动两者
npm run dev
```

## 技术栈

### 移动端 (`apps/mobile`)
- **框架**: React Native + Expo SDK 54
- **路由**: expo-router (文件系统路由)
- **状态管理**: Zustand
- **摄像头**: react-native-vision-camera
- **ML 推理**: CoreML + Vision (YOLOv8n 模型)
- **国际化**: i18next (中/英)

### 服务端 (`apps/server`)
- **框架**: Express + TypeScript
- **ORM**: Prisma
- **数据库**: SQLite (`apps/server/prisma/dev.db`)

### ML 模块 (`ml/`)
- YOLOv8n 目标检测模型
- Python 训练脚本

## 项目结构

```
superTennis/
├── apps/
│   ├── mobile/                  # React Native 移动端
│   │   ├── app/                 # Expo Router 页面
│   │   │   ├── (tabs)/          # Tab 导航 (首页、比赛、排行榜、训练、俱乐部、我的)
│   │   │   ├── match/           # 比赛流程 (setup → calibration → playing → result)
│   │   │   ├── demo/            # AI 演示模式
│   │   │   ├── hawkeye/         # 鹰眼测试
│   │   │   └── ...
│   │   ├── src/
│   │   │   ├── services/        # 核心服务
│   │   │   │   ├── api.ts           # API 客户端
│   │   │   │   ├── visionHawkEye.ts # 鹰眼核心逻辑
│   │   │   │   ├── tennisAI.ts      # AI 算法
│   │   │   │   └── nativeBallDetector.ts  # 原生 ML 桥接
│   │   │   ├── stores/          # Zustand 状态
│   │   │   │   ├── matchStore.ts
│   │   │   │   └── authStore.ts
│   │   │   ├── components/      # 组件
│   │   │   └── i18n/            # 国际化 (zh.ts, en.ts)
│   │   ├── ios/                 # iOS 原生代码
│   │   │   └── TennisBallDetector/  # CoreML 帧处理器
│   │   └── plugins/             # Expo Config Plugins
│   │
│   └── server/                  # Express 服务端
│       ├── src/
│       │   ├── index.ts         # 入口
│       │   └── routes/          # API 路由
│       │       ├── matches.ts   # 比赛 CRUD
│       │       ├── users.ts     # 用户
│       │       ├── clubs.ts     # 俱乐部
│       │       ├── friends.ts   # 好友
│       │       └── ...
│       └── prisma/
│           └── schema.prisma    # 数据库模型
│
├── ml/                          # ML 训练脚本
├── docs/                        # 项目文档
│   ├── PRD.md                   # 产品需求
│   ├── ARCHITECTURE.md          # 技术架构
│   ├── AI_ALGORITHM.md          # AI 算法
│   ├── API.md                   # API 文档
│   └── CHANGELOG.md             # 版本记录
└── evaluation_set/              # 评估数据集 (gitignored)
```

## 常用命令

```bash
# 开发
npm run dev:server              # 启动服务端
npm run dev:mobile              # 启动移动端
npm run dev                     # 同时启动

# 代码质量
npm run lint                    # ESLint 检查
npm run lint:fix                # 自动修复
npm run format                  # Prettier 格式化
npm run typecheck               # TypeScript 类型检查

# 测试
npm test                        # 运行所有测试
npm run test:watch              # 监听模式
npm run test:coverage           # 覆盖率报告

# 数据库
npm run db:push                 # 推送 schema 到数据库
npm run db:studio               # 打开 Prisma Studio

# 移动端专用
cd apps/mobile
npx expo start --ios            # iOS 模拟器
npx expo start --android        # Android 模拟器
npx eas build --platform ios    # EAS 构建
```

## 数据库模型 (关键)

主要模型定义在 `apps/server/prisma/schema.prisma`:

- **User** - 用户 (level 2.0-6.0, ELO rating)
- **Match** - 比赛记录 (比分、设置、视频)
- **Club** / **ClubMember** - 俱乐部
- **Friendship** - 好友关系
- **TrainingSession** / **TrainingGoal** - 训练
- **Notification** / **MatchInvite** - 通知邀请
- **MatchVideo** / **Highlight** - 视频与精彩瞬间

## API 端点

服务端运行在 `http://localhost:3001`，主要路由：

- `GET/POST /api/matches` - 比赛列表/创建
- `GET/PUT/DELETE /api/matches/:id` - 比赛详情
- `GET/POST /api/users` - 用户
- `GET/POST /api/clubs` - 俱乐部
- `GET/POST /api/friends` - 好友
- `GET /api/leaderboard` - 排行榜

详见 `docs/API.md`

## 代码风格约定

- **TypeScript** 严格模式
- **ESLint** + **Prettier** (配置已就绪)
- 文件命名：`camelCase.ts` (服务) / `PascalCase.tsx` (组件) / `kebab-case.tsx` (页面)
- 中文注释可接受（项目面向中文用户）
- Commit 格式：`type: description`（feat/fix/docs/style/refactor/test/ci）

## 注意事项

1. **移动端 API 地址**: `apps/mobile/src/services/api.ts` 中配置，开发时需确保手机/模拟器能访问服务端
2. **CoreML 模型**: 位于 `apps/mobile/ios/TennisBallDetector/yolov8n.mlpackage`
3. **真机调试**: 需要 EAS Build 生成 development client
4. **数据库**: SQLite 文件在 `apps/server/prisma/dev.db`，可用 `npm run db:studio` 查看

## 文档索引

| 文档 | 说明 |
|-----|------|
| [docs/PRD.md](docs/PRD.md) | 产品需求、用户流程、里程碑 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构、技术选型、数据流 |
| [docs/AI_ALGORITHM.md](docs/AI_ALGORITHM.md) | 鹰眼算法、网球检测、轨迹追踪 |
| [docs/API.md](docs/API.md) | RESTful API 接口定义 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 版本变更记录 |
| [ml/README.md](ml/README.md) | ML 模型训练文档 |

## 当前版本

**v0.3.1** - VisionCamera + CoreML 原生 ML 检测架构
