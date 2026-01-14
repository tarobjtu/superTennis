# SuperTennis 技术架构文档

## 1. 系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         SuperTennis                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Mobile App (Expo)                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │   UI Layer  │  │ State Mgmt  │  │   AI Services   │   │   │
│  │  │ (React Nav) │  │  (Zustand)  │  │  (TennisAI)     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │   Camera    │  │    Frame    │  │      Ball       │   │   │
│  │  │  (expo-cam) │  │  Processor  │  │   Detection     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              │ HTTP/REST                         │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Server (Express)                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │   Routes    │  │   Prisma    │  │     SQLite      │   │   │
│  │  │   (API)     │  │   (ORM)     │  │   (Database)    │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 目录结构

```
superTennis/
├── apps/
│   ├── mobile/                      # React Native 移动端
│   │   ├── app/                     # Expo Router 页面
│   │   │   ├── _layout.tsx          # 根布局
│   │   │   ├── index.tsx            # 首页
│   │   │   └── match/               # 比赛相关页面
│   │   │       ├── calibration.tsx  # 场地校准
│   │   │       ├── playing.tsx      # 比赛记分
│   │   │       └── replay.tsx       # 比赛回放
│   │   ├── src/
│   │   │   ├── services/            # 服务层
│   │   │   │   ├── tennisAI.ts      # AI 鹰眼核心
│   │   │   │   ├── ballDetection.ts # 网球检测
│   │   │   │   └── frameProcessor.ts# 帧处理器
│   │   │   └── stores/              # 状态管理
│   │   │       └── matchStore.ts    # 比赛状态
│   │   ├── app.json                 # Expo 配置
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── server/                      # Express 服务端
│       ├── src/
│       │   └── index.ts             # 服务入口
│       ├── prisma/
│       │   └── schema.prisma        # 数据库模型
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                            # 项目文档
│   ├── PRD.md                       # 产品需求文档
│   ├── ARCHITECTURE.md              # 技术架构文档
│   ├── AI_ALGORITHM.md              # AI 算法文档
│   └── API.md                       # API 接口文档
│
├── .gitignore
└── README.md
```

## 2. 移动端架构

### 2.1 技术选型

| 层级 | 技术 | 版本 | 说明 |
|-----|------|-----|------|
| 框架 | React Native | 0.76 | 跨平台移动开发 |
| 开发平台 | Expo | SDK 54 | 快速开发、OTA 更新 |
| 路由 | expo-router | 4.x | 文件系统路由 |
| 状态管理 | Zustand | 5.x | 轻量级状态管理 |
| 摄像头 | expo-camera | 16.x | 摄像头访问 |
| 文件系统 | expo-file-system | 18.x | 文件操作 |
| 语言 | TypeScript | 5.x | 类型安全 |

### 2.2 页面路由

```
app/
├── _layout.tsx          # 根布局 (Stack Navigator)
├── index.tsx            # 首页 "/"
└── match/
    ├── calibration.tsx  # 校准页 "/match/calibration"
    ├── playing.tsx      # 比赛页 "/match/playing"
    └── replay.tsx       # 回放页 "/match/replay"
```

### 2.3 状态管理

使用 Zustand 管理全局状态：

```typescript
// matchStore.ts
interface MatchState {
  // 比赛信息
  currentMatch: Match | null;

  // 比分
  score: {
    player1: PlayerScore;
    player2: PlayerScore;
  };

  // 校准数据
  calibration: CalibrationPoint[] | null;

  // AI 事件
  aiEvents: AIEvent[];

  // Actions
  startMatch: () => void;
  addPoint: (player: 'player1' | 'player2') => void;
  setCalibration: (points: CalibrationPoint[]) => void;
  recordAIEvent: (event: AIEvent) => void;
}
```

### 2.4 服务层

```
services/
├── tennisAI.ts         # AI 鹰眼核心逻辑
│   ├── setCalibration()     # 设置校准点
│   ├── processDetection()   # 处理检测结果
│   ├── checkBounce()        # 检测落地
│   └── isInBounds()         # 判断界内
│
├── ballDetection.ts    # 网球检测
│   ├── detectBall()         # HSV 颜色检测
│   ├── trackBall()          # 轨迹追踪
│   └── calculateVelocity()  # 速度计算
│
└── frameProcessor.ts   # 帧处理器
    ├── start()              # 开始处理
    ├── stop()               # 停止处理
    └── captureAndProcess()  # 捕获并分析
```

### 2.5 组件结构

```
比赛页面 (playing.tsx)
├── 比分显示区域
│   ├── 玩家1比分
│   └── 玩家2比分
├── AI 控制栏
│   ├── AI 状态指示器
│   └── 自动记分开关
├── 摄像头区域
│   ├── CameraView
│   └── 校准点覆盖层
└── 记分按钮区域
    ├── 玩家1得分按钮
    └── 玩家2得分按钮
```

## 3. 服务端架构

### 3.1 技术选型

| 层级 | 技术 | 版本 | 说明 |
|-----|------|-----|------|
| 运行时 | Node.js | 18+ | JavaScript 运行时 |
| 框架 | Express | 4.x | Web 框架 |
| ORM | Prisma | 6.x | 数据库 ORM |
| 数据库 | SQLite | 3.x | 轻量级数据库 |
| 语言 | TypeScript | 5.x | 类型安全 |

### 3.2 数据库模型

```prisma
// schema.prisma

model Match {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  status    String   @default("in_progress") // in_progress, completed

  player1Name String @default("Player 1")
  player2Name String @default("Player 2")

  // 比分 JSON
  score     String   @default("{}")

  // 校准数据 JSON
  calibration String?

  // AI 事件
  aiEvents  AIEvent[]
}

model AIEvent {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())

  matchId   String
  match     Match    @relation(fields: [matchId], references: [id])

  type      String   // bounce, trajectory, out_of_bounds
  positionX Float
  positionY Float
  isInBounds Boolean?
  confidence Float?
  metadata  String?  // JSON 额外数据
}
```

### 3.3 API 结构

```
/api
├── /matches
│   ├── GET    /           # 获取比赛列表
│   ├── POST   /           # 创建比赛
│   ├── GET    /:id        # 获取比赛详情
│   ├── PUT    /:id        # 更新比赛
│   └── DELETE /:id        # 删除比赛
│
└── /ai-events
    ├── GET    /:matchId   # 获取比赛的 AI 事件
    └── POST   /           # 记录 AI 事件
```

## 4. 数据流

### 4.1 比赛记分流程

```
用户点击记分
     │
     ▼
matchStore.addPoint()
     │
     ├─────────────────────┐
     ▼                     ▼
更新本地状态           同步到服务端
     │                     │
     ▼                     ▼
UI 更新比分显示      POST /api/matches/:id
```

### 4.2 AI 检测流程

```
CameraView
     │
     │ takePictureAsync (每 100ms)
     ▼
FrameProcessor
     │
     │ analyzeFrame()
     ▼
BallDetection
     │
     │ detectBall() + trackBall()
     ▼
TennisAI
     │
     ├─────────────────────────────────────┐
     │                                     │
     ▼                                     ▼
processDetection()                   checkBounce()
     │                                     │
     │ 更新轨迹历史                         │ 检测速度方向变化
     ▼                                     ▼
isInBounds()                         触发 onBounceDetected
     │                                     │
     │ 透视变换 + 边界检查                   │
     ▼                                     ▼
返回判定结果 ─────────────────────────► 自动记分 (可选)
```

### 4.3 状态同步流程

```
┌─────────────┐    状态变化    ┌─────────────┐
│   Zustand   │ ───────────► │  React UI   │
│   Store     │              │  Components │
└─────────────┘              └─────────────┘
       │
       │ 异步同步
       ▼
┌─────────────┐    HTTP     ┌─────────────┐
│   API       │ ─────────► │   Server    │
│   Client    │            │   (Express) │
└─────────────┘            └─────────────┘
                                  │
                                  ▼
                           ┌─────────────┐
                           │   SQLite    │
                           │   Database  │
                           └─────────────┘
```

## 5. 关键技术实现

### 5.1 摄像头帧处理

由于 Expo Camera 不支持原生帧回调，使用定时器方案：

```typescript
class FrameProcessor {
  private intervalId: NodeJS.Timer | null = null;

  start() {
    this.intervalId = setInterval(() => {
      this.captureAndProcess();
    }, 100); // 10 FPS
  }

  async captureAndProcess() {
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.3,
      base64: true,
      skipProcessing: true,
    });

    // 分析帧
    const result = await this.analyzeFrame(photo);

    // 清理临时文件
    await FileSystem.deleteAsync(photo.uri);
  }
}
```

### 5.2 透视变换

将摄像头像素坐标转换为球场坐标：

```typescript
// 四点透视变换矩阵
function getPerspectiveTransform(
  src: Point[],  // 摄像头中的四角像素坐标
  dst: Point[]   // 标准球场四角坐标
): Matrix {
  // 计算透视变换矩阵 H
  // 使用 DLT (Direct Linear Transform) 算法
}

function transformPoint(pixel: Point, H: Matrix): Point {
  // 应用透视变换
  // p' = H * p
}
```

### 5.3 落点检测

通过速度方向变化检测球落地：

```typescript
function detectBounce(history: BallPosition[]): boolean {
  if (history.length < 3) return false;

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const prev2 = history[history.length - 3];

  // 计算垂直速度
  const vy1 = prev.y - prev2.y;
  const vy2 = latest.y - prev.y;

  // 速度方向反转 = 落地反弹
  return vy1 > 0 && vy2 < 0;
}
```

## 6. 性能优化

### 6.1 帧处理优化

- 降低图片质量 (quality: 0.3)
- 跳过不必要的图片处理 (skipProcessing: true)
- 限制处理帧率 (10 FPS)
- 及时清理临时文件

### 6.2 状态更新优化

- Zustand 选择器避免不必要的重渲染
- 批量更新减少渲染次数
- 使用 `React.memo` 优化子组件

### 6.3 内存管理

- 限制轨迹历史长度 (最近 100 帧)
- 及时清理 base64 数据
- 避免内存泄漏 (清理定时器、事件监听)

## 7. 扩展性设计

### 7.1 AI 算法可插拔

```typescript
interface BallDetector {
  detect(frame: ImageData): DetectedBall[];
}

// 当前实现：HSV 颜色检测
class HSVBallDetector implements BallDetector { }

// 未来实现：ML 模型检测
class MLBallDetector implements BallDetector { }
```

### 7.2 多摄像头支持

```typescript
interface CameraSource {
  id: string;
  type: 'builtin' | 'external';
  position: 'left' | 'right' | 'overhead';
}

class MultiCameraProcessor {
  cameras: CameraSource[];

  // 融合多个摄像头的检测结果
  fuseDetections(detections: Map<string, Detection[]>): FusedDetection;
}
```

### 7.3 数据同步策略

```typescript
interface SyncStrategy {
  // 实时同步
  realtime: boolean;

  // 批量同步间隔
  batchInterval: number;

  // 离线缓存
  offlineCache: boolean;
}
```

## 8. 安全考虑

### 8.1 权限管理

- 摄像头权限：运行时请求，明确说明用途
- 存储权限：仅存储必要的比赛数据
- 网络权限：仅用于数据同步

### 8.2 数据安全

- 本地数据使用 SQLite 存储
- 敏感数据不上传云端
- API 通信使用 HTTPS (生产环境)

### 8.3 隐私保护

- 不存储原始视频
- 仅保留检测结果和统计数据
- 用户可随时删除比赛记录
