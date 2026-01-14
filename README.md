# SuperTennis

AI 驱动的网球比赛记分与鹰眼判定系统。

## 功能特性

- **智能记分** - 支持手动记分和 AI 自动记分
- **鹰眼系统** - 实时追踪网球轨迹，自动判定界内/出界
- **场地校准** - 四点透视变换，将摄像头画面映射到标准网球场坐标
- **比赛回放** - 查看 AI 分析结果，包括球轨迹和落点判定
- **数据持久化** - 比赛记录存储在服务端

## 技术栈

### 移动端 (apps/mobile)
- React Native + Expo SDK 54
- TypeScript
- Zustand 状态管理
- expo-camera 摄像头采集
- expo-router 导航

### 服务端 (apps/server)
- Node.js + Express
- Prisma ORM
- SQLite 数据库

### AI 模块
- HSV 颜色空间网球检测
- 卡尔曼滤波轨迹平滑
- 速度方向变化落点检测
- 透视变换坐标转换

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- iOS 模拟器 或 真机 (需要 Expo Go)

### 安装依赖

```bash
# 安装移动端依赖
cd apps/mobile
npm install

# 安装服务端依赖
cd ../server
npm install
```

### 启动服务

```bash
# 启动服务端 (端口 3001)
cd apps/server
npm run dev

# 启动移动端
cd apps/mobile
npx expo start --ios
```

### 使用流程

1. **开始比赛** - 在首页点击"开始比赛"
2. **场地校准** - 标记球场四个角点（左上、右上、右下、左下）
3. **比赛记分** - 手动点击记分或开启 AI 自动记分
4. **查看回放** - 比赛结束后可查看 AI 分析结果

## 项目结构

```
superTennis/
├── apps/
│   ├── mobile/                 # React Native 移动端
│   │   ├── app/               # 页面路由
│   │   │   ├── index.tsx      # 首页
│   │   │   └── match/         # 比赛相关页面
│   │   │       ├── calibration.tsx  # 场地校准
│   │   │       ├── playing.tsx      # 比赛记分
│   │   │       └── replay.tsx       # 比赛回放
│   │   └── src/
│   │       ├── services/      # AI 服务
│   │       │   ├── tennisAI.ts       # 鹰眼核心
│   │       │   ├── ballDetection.ts  # 网球检测
│   │       │   └── frameProcessor.ts # 帧处理器
│   │       └── stores/        # 状态管理
│   │           └── matchStore.ts
│   └── server/                 # Express 服务端
│       ├── src/
│       │   └── index.ts
│       └── prisma/
│           └── schema.prisma
└── README.md
```

## AI 鹰眼工作原理

1. **帧采集** - 通过 expo-camera 周期性捕获画面
2. **球检测** - 使用 HSV 颜色空间识别黄绿色网球
3. **轨迹追踪** - 卡尔曼滤波平滑轨迹，计算速度向量
4. **落点检测** - 检测速度垂直分量反向（球落地反弹）
5. **坐标转换** - 透视变换将像素坐标转为球场坐标
6. **界内判定** - 根据球场标准尺寸判断落点是否在界内

## License

MIT
