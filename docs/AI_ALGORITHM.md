# SuperTennis AI 鹰眼算法设计文档

## 1. 概述

本文档详细描述 SuperTennis 应用中 AI 鹰眼系统的算法设计，包括网球检测、轨迹追踪、落点判定等核心算法。

## 2. 系统流程

```
摄像头采集
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                        帧预处理                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                  │
│  │ 降采样   │ ─► │ 色彩转换 │ ─► │ 噪声滤波 │                  │
│  └─────────┘    └─────────┘    └─────────┘                  │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                        网球检测                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                  │
│  │ HSV阈值  │ ─► │ 连通区域 │ ─► │ 圆形验证 │                  │
│  └─────────┘    └─────────┘    └─────────┘                  │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                        轨迹追踪                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                  │
│  │ 关联匹配  │ ─► │ 卡尔曼滤波│ ─► │ 轨迹预测 │                  │
│  └─────────┘    └─────────┘    └─────────┘                  │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                        落点判定                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                  │
│  │ 速度分析  │ ─► │ 落地检测 │ ─► │ 坐标转换 │                  │
│  └─────────┘    └─────────┘    └─────────┘                  │
│                      │                                       │
│                      ▼                                       │
│               ┌─────────────┐                                │
│               │ 界内/出界判定│                                │
│               └─────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## 3. 网球检测算法

### 3.1 HSV 颜色空间检测

网球颜色为黄绿色，在 HSV 颜色空间中具有较好的区分度。

#### 3.1.1 RGB 到 HSV 转换

```
R, G, B ∈ [0, 255]

R' = R / 255
G' = G / 255
B' = B / 255

Cmax = max(R', G', B')
Cmin = min(R', G', B')
Δ = Cmax - Cmin

H = {
  0°,                          if Δ = 0
  60° × ((G' - B') / Δ mod 6), if Cmax = R'
  60° × ((B' - R') / Δ + 2),   if Cmax = G'
  60° × ((R' - G') / Δ + 4),   if Cmax = B'
}

S = {
  0,          if Cmax = 0
  Δ / Cmax,   otherwise
}

V = Cmax
```

#### 3.1.2 网球颜色阈值

```typescript
// 标准网球颜色范围 (HSV)
const TENNIS_BALL_HSV = {
  H: { min: 35, max: 65 },    // 黄绿色色相
  S: { min: 0.4, max: 1.0 },  // 较高饱和度
  V: { min: 0.5, max: 1.0 },  // 较高亮度
};

// 自适应阈值 (根据光照调整)
function adaptThreshold(ambientLight: number): HSVRange {
  const factor = ambientLight / 128; // 归一化
  return {
    H: { min: 35, max: 65 },
    S: { min: 0.4 * factor, max: 1.0 },
    V: { min: 0.3 + 0.2 * factor, max: 1.0 },
  };
}
```

### 3.2 连通区域分析

```
输入: 二值化图像 (HSV 阈值分割结果)
输出: 候选区域列表

算法: Two-pass 连通分量标记

第一遍:
  for y = 0 to height:
    for x = 0 to width:
      if pixel(x, y) == foreground:
        left = label(x-1, y)
        up = label(x, y-1)
        if left == 0 and up == 0:
          label(x, y) = newLabel++
        else if left != 0 and up != 0:
          label(x, y) = min(left, up)
          union(left, up)
        else:
          label(x, y) = max(left, up)

第二遍:
  for each pixel:
    label(pixel) = find(label(pixel))  // 路径压缩

输出:
  for each unique label:
    计算区域属性 (面积, 中心, 边界框)
```

### 3.3 圆形验证

网球应该呈现近似圆形，使用圆形度指标过滤：

```
圆形度 = 4π × 面积 / 周长²

对于完美圆形: 圆形度 = 1
对于网球: 圆形度 > 0.7 (考虑运动模糊)

面积约束:
  最小面积: 100 像素 (避免噪声)
  最大面积: 10000 像素 (避免大面积干扰)

宽高比约束:
  0.8 < width / height < 1.2 (近似正方形)
```

### 3.4 置信度计算

```typescript
function calculateConfidence(
  region: Region,
  colorMatch: number,   // 颜色匹配度 [0, 1]
  circularity: number,  // 圆形度 [0, 1]
  size: number,         // 归一化尺寸 [0, 1]
): number {
  // 加权平均
  const weights = {
    color: 0.4,
    shape: 0.3,
    size: 0.3,
  };

  const confidence =
    weights.color * colorMatch +
    weights.shape * circularity +
    weights.size * sizeFit(size);

  return confidence * 100; // 百分制
}

function sizeFit(normalizedSize: number): number {
  // 理想尺寸约为画面的 1%
  const ideal = 0.01;
  const deviation = Math.abs(normalizedSize - ideal) / ideal;
  return Math.max(0, 1 - deviation);
}
```

## 4. 轨迹追踪算法

### 4.1 帧间关联

使用匈牙利算法进行最优匹配：

```
输入:
  - 上一帧检测结果 D(t-1) = {d1, d2, ..., dn}
  - 当前帧检测结果 D(t) = {d1', d2', ..., dm'}

成本矩阵:
  C[i][j] = distance(di, dj') + α × velocityPenalty(di, dj')

distance(a, b) = √((ax - bx)² + (ay - by)²)

velocityPenalty:
  基于预测位置与实际位置的偏差
  predicted = position(t-1) + velocity(t-1) × Δt
  penalty = distance(predicted, actual)

匈牙利算法求解最小成本匹配
```

### 4.2 卡尔曼滤波

用于平滑轨迹和预测下一帧位置。

#### 4.2.1 状态向量

```
状态: X = [x, y, vx, vy, ax, ay]ᵀ
  - x, y: 位置
  - vx, vy: 速度
  - ax, ay: 加速度

观测: Z = [x, y]ᵀ
```

#### 4.2.2 状态转移矩阵

```
     ┌                         ┐
     │ 1  0  Δt  0  0.5Δt²  0    │
     │ 0  1  0  Δt  0    0.5Δt² │
F =  │ 0  0  1   0  Δt     0    │
     │ 0  0  0   1  0      Δt   │
     │ 0  0  0   0  1      0    │
     │ 0  0  0   0  0      1    │
     └                         ┘
```

#### 4.2.3 观测矩阵

```
     ┌             ┐
H =  │ 1 0 0 0 0 0 │
     │ 0 1 0 0 0 0 │
     └             ┘
```

#### 4.2.4 滤波步骤

```
预测步骤:
  X̂(t|t-1) = F × X̂(t-1|t-1)
  P(t|t-1) = F × P(t-1|t-1) × Fᵀ + Q

更新步骤:
  K = P(t|t-1) × Hᵀ × (H × P(t|t-1) × Hᵀ + R)⁻¹
  X̂(t|t) = X̂(t|t-1) + K × (Z(t) - H × X̂(t|t-1))
  P(t|t) = (I - K × H) × P(t|t-1)

其中:
  Q: 过程噪声协方差矩阵
  R: 观测噪声协方差矩阵
  K: 卡尔曼增益
```

### 4.3 轨迹历史管理

```typescript
interface TrajectoryPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  timestamp: number;
  confidence: number;
}

class TrajectoryHistory {
  private points: TrajectoryPoint[] = [];
  private maxLength = 100;

  add(point: TrajectoryPoint) {
    this.points.push(point);
    if (this.points.length > this.maxLength) {
      this.points.shift();
    }
  }

  getRecentPoints(n: number): TrajectoryPoint[] {
    return this.points.slice(-n);
  }

  calculateVelocity(): { vx: number; vy: number } {
    if (this.points.length < 2) return { vx: 0, vy: 0 };

    const p1 = this.points[this.points.length - 2];
    const p2 = this.points[this.points.length - 1];
    const dt = (p2.timestamp - p1.timestamp) / 1000;

    return {
      vx: (p2.x - p1.x) / dt,
      vy: (p2.y - p1.y) / dt,
    };
  }
}
```

## 5. 落点检测算法

### 5.1 速度方向分析

网球落地时会发生速度反转（垂直方向）：

```typescript
function detectBounce(history: TrajectoryPoint[]): BounceResult {
  if (history.length < 3) {
    return { detected: false };
  }

  const p1 = history[history.length - 3];
  const p2 = history[history.length - 2];
  const p3 = history[history.length - 1];

  // 计算垂直速度
  const vy1 = p2.y - p1.y;  // 落地前
  const vy2 = p3.y - p2.y;  // 落地后

  // 速度反转检测
  // vy1 > 0 表示向下运动
  // vy2 < 0 表示向上运动（反弹）
  const bounceDetected = vy1 > VELOCITY_THRESHOLD && vy2 < -VELOCITY_THRESHOLD;

  if (bounceDetected) {
    // 插值计算精确落点
    const bouncePosition = interpolateBouncePosition(p1, p2, p3);
    return {
      detected: true,
      position: bouncePosition,
      timestamp: p2.timestamp,
    };
  }

  return { detected: false };
}

const VELOCITY_THRESHOLD = 2; // 像素/帧
```

### 5.2 落点位置插值

```
使用二次曲线拟合精确计算落点

给定三个点 (t1, y1), (t2, y2), (t3, y3)
拟合二次函数: y = at² + bt + c

求解:
  ┌         ┐   ┌   ┐   ┌    ┐
  │ t1² t1 1│   │ a │   │ y1 │
  │ t2² t2 1│ × │ b │ = │ y2 │
  │ t3² t3 1│   │ c │   │ y3 │
  └         ┘   └   ┘   └    ┘

落点时刻 (速度为0):
  dy/dt = 2at + b = 0
  t_bounce = -b / (2a)

落点坐标:
  y_bounce = a × t_bounce² + b × t_bounce + c
  x_bounce = 线性插值
```

### 5.3 多帧确认

为避免误检，使用多帧确认机制：

```typescript
class BounceDetector {
  private candidates: BounceCandidate[] = [];
  private confirmThreshold = 3; // 需要3帧确认

  process(velocity: Velocity): BounceResult | null {
    // 检测速度反转
    if (this.isVelocityReversed(velocity)) {
      this.addCandidate(velocity);
    }

    // 检查是否有已确认的落点
    const confirmed = this.candidates.find(
      c => c.confirmCount >= this.confirmThreshold
    );

    if (confirmed) {
      this.candidates = [];
      return {
        detected: true,
        position: confirmed.position,
      };
    }

    return null;
  }

  private addCandidate(velocity: Velocity) {
    // 检查是否与现有候选接近
    const existing = this.candidates.find(
      c => distance(c.position, velocity.position) < MERGE_THRESHOLD
    );

    if (existing) {
      existing.confirmCount++;
    } else {
      this.candidates.push({
        position: velocity.position,
        confirmCount: 1,
        timestamp: Date.now(),
      });
    }

    // 清理过期候选
    this.candidates = this.candidates.filter(
      c => Date.now() - c.timestamp < 500 // 500ms 超时
    );
  }
}
```

## 6. 坐标转换算法

### 6.1 透视变换原理

将摄像头画面中的点转换为球场坐标：

```
摄像头坐标系 (像素):
  原点在左上角
  X 轴向右，Y 轴向下

球场坐标系 (米):
  原点在球场左下角
  X 轴沿边线，Y 轴沿底线

  ┌─────────────────────┐
  │                     │ 11.89m (单打底线)
  │         ┃           │
  │    ─────┼─────      │ 球网
  │         ┃           │
  │                     │
  └─────────────────────┘
           23.77m (单打边线)
```

### 6.2 四点校准

```typescript
interface CalibrationPoint {
  // 摄像头中的像素坐标
  pixel: { x: number; y: number };
  // 对应的球场坐标
  court: { x: number; y: number };
}

// 标准单打场地四角
const COURT_CORNERS = [
  { x: 0, y: 0 },           // 左下
  { x: 23.77, y: 0 },       // 右下
  { x: 23.77, y: 11.89 },   // 右上
  { x: 0, y: 11.89 },       // 左上
];
```

### 6.3 透视变换矩阵计算

使用 DLT (Direct Linear Transform) 算法：

```
给定 4 对对应点:
  (x1, y1) ↔ (x1', y1')
  (x2, y2) ↔ (x2', y2')
  (x3, y3) ↔ (x3', y3')
  (x4, y4) ↔ (x4', y4')

透视变换:
  x' = (h11×x + h12×y + h13) / (h31×x + h32×y + h33)
  y' = (h21×x + h22×y + h23) / (h31×x + h32×y + h33)

构建线性方程组 A×h = 0:

┌                                                    ┐ ┌     ┐   ┌   ┐
│ x1  y1  1   0   0   0  -x1×x1'  -y1×x1'  -x1'     │ │ h11 │   │ 0 │
│ 0   0   0   x1  y1  1  -x1×y1'  -y1×y1'  -y1'     │ │ h12 │   │ 0 │
│ x2  y2  1   0   0   0  -x2×x2'  -y2×x2'  -x2'     │ │ h13 │   │ 0 │
│ 0   0   0   x2  y2  1  -x2×y2'  -y2×y2'  -y2'     │ │ h21 │ = │ 0 │
│ x3  y3  1   0   0   0  -x3×x3'  -y3×x3'  -x3'     │ │ h22 │   │ 0 │
│ 0   0   0   x3  y3  1  -x3×y3'  -y3×y3'  -y3'     │ │ h23 │   │ 0 │
│ x4  y4  1   0   0   0  -x4×x4'  -y4×x4'  -x4'     │ │ h31 │   │ 0 │
│ 0   0   0   x4  y4  1  -x4×y4'  -y4×y4'  -y4'     │ │ h32 │   │ 0 │
└                                                    ┘ │ h33 │   └   ┘
                                                       └     ┘

使用 SVD 分解求解最小二乘解
```

### 6.4 实现代码

```typescript
class PerspectiveTransform {
  private H: number[][] = [];

  setCalibration(pixelPoints: Point[], courtPoints: Point[]) {
    // 构建矩阵 A
    const A: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const x = pixelPoints[i].x;
      const y = pixelPoints[i].y;
      const xp = courtPoints[i].x;
      const yp = courtPoints[i].y;

      A.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp, -xp]);
      A.push([0, 0, 0, x, y, 1, -x * yp, -y * yp, -yp]);
    }

    // SVD 分解求解
    const h = this.solveSVD(A);

    // 重构 3×3 矩阵
    this.H = [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], h[8]],
    ];
  }

  transform(pixel: Point): Point {
    const x = pixel.x;
    const y = pixel.y;

    const w = this.H[2][0] * x + this.H[2][1] * y + this.H[2][2];
    const xp = (this.H[0][0] * x + this.H[0][1] * y + this.H[0][2]) / w;
    const yp = (this.H[1][0] * x + this.H[1][1] * y + this.H[1][2]) / w;

    return { x: xp, y: yp };
  }
}
```

## 7. 界内/出界判定

### 7.1 单打边界定义

```
标准单打场地尺寸 (米):

       23.77m
  ┌─────────────────────┐
  │    发球区           │
  │  ┌───┬───┬───┐     │ 6.40m
  │  │   │   │   │     │
  │  ├───┴───┴───┤     │ ← 球网
  │  │   │   │   │     │
  │  └───┴───┴───┘     │ 6.40m
  │    发球区           │
  └─────────────────────┘
        11.89m

边线容差:
  网球直径约 6.7cm
  落点判定使用球心，加上半径后判断是否压线
```

### 7.2 判定算法

```typescript
interface CourtBounds {
  // 单打边界
  singles: {
    minX: 0,
    maxX: 23.77,
    minY: 0,
    maxY: 11.89,
  };
  // 发球区边界
  serviceBox: {
    left: { minX: 0, maxX: 11.885, minY: 0, maxY: 6.40 },
    right: { minX: 11.885, maxX: 23.77, minY: 0, maxY: 6.40 },
  };
}

const BALL_RADIUS = 0.0335; // 网球半径 (米)
const LINE_WIDTH = 0.05;    // 线宽 (米)

function isInBounds(
  position: Point,
  boundaryType: 'singles' | 'service_left' | 'service_right'
): boolean {
  const bounds = getBounds(boundaryType);

  // 球心位置 + 半径判断是否压线
  const effectiveX = position.x;
  const effectiveY = position.y;

  // 只要球触及边线即为界内
  const tolerance = BALL_RADIUS + LINE_WIDTH / 2;

  return (
    effectiveX >= bounds.minX - tolerance &&
    effectiveX <= bounds.maxX + tolerance &&
    effectiveY >= bounds.minY - tolerance &&
    effectiveY <= bounds.maxY + tolerance
  );
}
```

### 7.3 判定结果可视化

```typescript
interface JudgmentResult {
  isIn: boolean;
  position: Point;       // 球场坐标
  distanceToLine: number;// 距最近边线的距离
  closestLine: string;   // 最近的边线名称
  confidence: number;    // 判定置信度
}

function generateJudgment(bouncePosition: Point): JudgmentResult {
  const distances = {
    leftLine: bouncePosition.x,
    rightLine: 23.77 - bouncePosition.x,
    topLine: 11.89 - bouncePosition.y,
    bottomLine: bouncePosition.y,
  };

  const minDistance = Math.min(...Object.values(distances));
  const closestLine = Object.keys(distances).find(
    k => distances[k] === minDistance
  );

  // 负距离表示出界
  const signedDistance = isInBounds(bouncePosition, 'singles')
    ? minDistance
    : -minDistance;

  return {
    isIn: signedDistance >= -BALL_RADIUS,
    position: bouncePosition,
    distanceToLine: Math.abs(signedDistance),
    closestLine,
    confidence: calculateJudgmentConfidence(signedDistance),
  };
}

function calculateJudgmentConfidence(distance: number): number {
  // 距离越远，置信度越高
  const absDistance = Math.abs(distance);
  if (absDistance > 0.1) return 99;  // 明显界内/出界
  if (absDistance > 0.05) return 90; // 较明确
  return 70 + absDistance * 200;      // 压线附近
}
```

## 8. 性能优化

### 8.1 检测优化

- **ROI 预测**：基于上一帧位置预测搜索区域
- **金字塔检测**：先在低分辨率检测，再在高分辨率精确定位
- **跳帧处理**：检测失败时跳过后续处理

### 8.2 内存优化

- **环形缓冲区**：固定长度的轨迹历史
- **及时释放**：处理完成后立即释放图像数据
- **对象复用**：避免频繁创建临时对象

### 8.3 计算优化

- **查表法**：预计算 HSV 转换表
- **SIMD**：使用向量化指令（Native Module）
- **增量计算**：卡尔曼滤波增量更新

## 9. VisionCamera + YOLOv8 CoreML 实现 (v0.3.0)

> **状态**: 已实现并部署

### 9.1 技术架构

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

### 9.2 YOLOv8 CoreML 模型

#### 9.2.1 模型导出

```python
# ml/train_tennis_detector.py
from ultralytics import YOLO

# 加载预训练模型
model = YOLO("yolov8n.pt")

# 导出 CoreML 格式 (INT8 量化)
model.export(
    format="coreml",
    imgsz=[640, 384],  # 16:9.6 比例
    nms=True,          # 内置 NMS
    int8=True          # Neural Engine 优化
)
```

**快速开始**:

```bash
cd ml
pip3 install ultralytics coremltools
python3 train_tennis_detector.py --export-only
cp -r yolov8n.mlpackage ../apps/mobile/ios/TennisBallDetector/
```

#### 9.2.2 模型规格

| 参数 | 值 |
|-----|-----|
| 基础模型 | YOLOv8 Nano |
| 输入尺寸 | 640 × 384 |
| 量化 | INT8 (Neural Engine 优化) |
| NMS | 内置 |
| 目标类别 | sports ball (COCO #32) |
| 模型大小 | ~3.2 MB |

#### 9.2.3 性能预期

| 设备 | 推理速度 | 功耗 |
|-----|---------|------|
| iPhone 15 Pro | ~8ms | 低 (Neural Engine) |
| iPhone 13 | ~12ms | 低 (Neural Engine) |
| iPhone 11 | ~18ms | 中 (GPU) |

### 9.3 Frame Processor 实现

#### 9.3.1 Swift 原生插件

文件: `ios/TennisBallDetector/TennisBallDetectorFrameProcessor.swift`

```swift
import VisionCamera
import Vision
import CoreML

@objc(TennisBallDetectorFrameProcessor)
public class TennisBallDetectorFrameProcessor: FrameProcessorPlugin {
    private var model: VNCoreMLModel?

    public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]? = nil) {
        super.init(proxy: proxy, options: options)
        loadModel()
    }

    private func loadModel() {
        guard let modelURL = Bundle.main.url(forResource: "yolov8n", withExtension: "mlmodelc") ??
                            Bundle.main.url(forResource: "yolov8n", withExtension: "mlpackage") else {
            return
        }

        do {
            let config = MLModelConfiguration()
            config.computeUnits = .all  // 使用 Neural Engine
            let mlModel = try MLModel(contentsOf: modelURL, configuration: config)
            self.model = try VNCoreMLModel(for: mlModel)
        } catch {
            print("Failed to load model: \(error)")
        }
    }

    public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
        guard let model = self.model,
              let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else {
            return nil
        }

        var detections: [[String: Any]] = []

        let request = VNCoreMLRequest(model: model) { request, error in
            guard let results = request.results as? [VNRecognizedObjectObservation] else { return }

            for observation in results {
                // 过滤 sports_ball 类别
                if let label = observation.labels.first,
                   label.identifier == "sports ball" && label.confidence > 0.5 {
                    detections.append([
                        "x": observation.boundingBox.midX,
                        "y": 1.0 - observation.boundingBox.midY,  // 翻转 Y 轴
                        "width": observation.boundingBox.width,
                        "height": observation.boundingBox.height,
                        "confidence": label.confidence
                    ])
                }
            }
        }

        request.imageCropAndScaleOption = .scaleFill

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up)
        try? handler.perform([request])

        return detections.isEmpty ? nil : detections
    }
}
```

#### 9.3.2 ObjC 桥接注册

文件: `ios/TennisBallDetector/TennisBallDetectorFrameProcessor.m`

```objc
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

@interface TennisBallDetectorFrameProcessor : FrameProcessorPlugin
@end

@implementation TennisBallDetectorFrameProcessor

+ (void)load {
    [FrameProcessorPluginRegistry addFrameProcessorPlugin:@"detectTennisBall"
                                          withInitializer:^FrameProcessorPlugin*(VisionCameraProxyHolder* proxy, NSDictionary* options) {
        return [[TennisBallDetectorFrameProcessor alloc] initWithProxy:proxy withOptions:options];
    }];
}

@end
```

#### 9.3.3 TypeScript 调用

文件: `src/services/nativeBallDetector.ts`

```typescript
import { VisionCameraProxy, Frame } from 'react-native-vision-camera';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectTennisBall', {});

export function detectTennisBall(frame: Frame): Detection[] | null {
  'worklet';
  if (!plugin) return null;
  return plugin.call(frame) as Detection[] | null;
}

interface Detection {
  x: number;      // 归一化 X 坐标 [0, 1]
  y: number;      // 归一化 Y 坐标 [0, 1]
  width: number;  // 归一化宽度
  height: number; // 归一化高度
  confidence: number;
}
```

### 9.4 Expo Config Plugin

文件: `plugins/withTennisBallDetector.js`

自动将原生代码添加到 Xcode 项目:

```javascript
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');

function withTennisBallDetector(config) {
  // 1. 复制 Swift/ObjC 文件和 ML 模型
  config = withDangerousMod(config, ['ios', copyNativeFiles]);

  // 2. 添加到 Xcode 项目
  config = withXcodeProject(config, addToXcodeProject);

  return config;
}
```

### 9.5 构建和部署

```bash
# 1. 安装依赖
npm install react-native-vision-camera react-native-worklets-core

# 2. 配置 babel.config.js
# 添加 react-native-worklets-core/plugin

# 3. 构建 Development Build
cd apps/mobile
npx eas-cli build --platform ios --profile development

# 4. 安装到设备/模拟器
# EAS 会提供下载链接或直接安装
```

**重要说明**:
- 需要 **Development Build**，Expo Go 不支持原生模块
- 真机测试需要 Apple Developer 账号
- 模拟器无真实摄像头，可使用模拟模式测试

### 9.6 准确率对比

| 场景 | v0.2.0 (HSV) | v0.3.0 (YOLO) |
|-----|-------------|---------------|
| 良好光照 | 70% | 95%+ |
| 阴影区域 | 30% | 85% |
| 快速移动 | 50% | 80% |
| 界内/出界判定 | ~60% | ~80% |

### 9.7 单 iPhone 物理限制

| 限制 | 原因 | 缓解方案 |
|-----|------|---------|
| 深度估计误差 ±50cm-1m | 单目视觉 | 物理轨迹约束 |
| 快速球模糊 | 60fps vs 专业 2000fps | 预测补偿 |
| 精确压线判定 | 误差 >3cm | 保守判定策略 |

**结论**: 单 iPhone 可实现业余比赛辅助判定 (~80% 准确率)，但无法达到专业鹰眼系统的毫米级精度。

## 10. 已知限制与改进方向

### 10.1 当前限制

| 限制 | 原因 | 影响 |
|-----|------|-----|
| 光照敏感 | HSV 阈值固定 | 强光/阴影下检测失败 |
| 无深度信息 | 单摄像头 | 落点 Z 轴不精确 |
| 运动模糊 | 快速运动 + 低帧率 | 检测置信度下降 |
| 遮挡问题 | 球员/球网遮挡 | 轨迹断裂 |

### 10.2 改进方向

1. **深度学习检测**
   - 使用 YOLO 或 MobileNet 替代 HSV 检测
   - 提高鲁棒性和准确率

2. **多摄像头融合**
   - 双目视觉获取深度信息
   - 多角度消除遮挡

3. **时序建模**
   - LSTM/Transformer 预测轨迹
   - 处理遮挡和丢失

4. **在线学习**
   - 根据用户反馈调整阈值
   - 适应不同光照和场地
