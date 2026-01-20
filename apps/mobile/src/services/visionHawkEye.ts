/**
 * VisionCamera 鹰眼检测服务
 * 使用 react-native-vision-camera Frame Processors 实现实时网球检测
 *
 * 技术栈:
 * - react-native-vision-camera v4
 * - Frame Processors (JavaScript Worklets)
 * - Kalman Filter 轨迹追踪
 * - 透视变换坐标转换
 */

import { CalibrationPoint } from '../stores/matchStore';

// 球检测结果
export interface BallDetection {
  x: number; // 屏幕坐标 x
  y: number; // 屏幕坐标 y
  confidence: number; // 置信度 0-1
  timestamp: number; // 时间戳
  frameWidth: number;
  frameHeight: number;
}

// 轨迹点
export interface TrajectoryPoint {
  screenX: number;
  screenY: number;
  courtX: number;
  courtY: number;
  timestamp: number;
  velocity: { vx: number; vy: number };
  speed: number; // m/s
}

// 落地事件
export interface BounceEvent {
  screenPosition: { x: number; y: number };
  courtPosition: { x: number; y: number };
  timestamp: number;
  isInBounds: boolean;
  confidence: number;
  distanceFromLine: number; // mm
}

// 鹰眼分析结果
export interface HawkEyeAnalysis {
  trajectory: TrajectoryPoint[];
  bounceEvents: BounceEvent[];
  ballSpeed: number; // km/h
  lastDetection: BallDetection | null;
  isTracking: boolean;
}

// 网球场标准尺寸 (米)
export const COURT_DIMENSIONS = {
  // 单打场地
  singles: {
    length: 23.77,
    width: 8.23,
    halfLength: 11.885,
    halfWidth: 4.115,
  },
  // 双打场地
  doubles: {
    length: 23.77,
    width: 10.97,
    halfLength: 11.885,
    halfWidth: 5.485,
  },
  // 发球区
  serviceBox: {
    length: 6.4,
    width: 4.115,
  },
  // 其他
  netHeight: 0.914,
  baselineToServiceLine: 5.485,
};

/**
 * Kalman Filter 用于轨迹平滑和预测
 */
class KalmanFilter {
  private x: number[] = [0, 0, 0, 0]; // [x, y, vx, vy]
  private P: number[][] = [
    [1000, 0, 0, 0],
    [0, 1000, 0, 0],
    [0, 0, 1000, 0],
    [0, 0, 0, 1000],
  ];
  private Q: number = 0.1; // 过程噪声
  private R: number = 10; // 测量噪声
  private lastTimestamp: number = 0;

  predict(dt: number): { x: number; y: number; vx: number; vy: number } {
    // 状态转移矩阵
    const F = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    // 预测状态
    const newX = [
      F[0][0] * this.x[0] + F[0][2] * this.x[2],
      F[1][1] * this.x[1] + F[1][3] * this.x[3],
      this.x[2],
      this.x[3],
    ];

    // 预测协方差 (简化)
    for (let i = 0; i < 4; i++) {
      this.P[i][i] += this.Q;
    }

    this.x = newX;
    return { x: this.x[0], y: this.x[1], vx: this.x[2], vy: this.x[3] };
  }

  update(
    measuredX: number,
    measuredY: number,
    timestamp: number
  ): { x: number; y: number; vx: number; vy: number } {
    const dt = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 0.033;
    this.lastTimestamp = timestamp;

    if (dt > 0) {
      this.predict(dt);
    }

    // 卡尔曼增益 (简化)
    const K = this.P[0][0] / (this.P[0][0] + this.R);

    // 更新状态
    const innovation = [measuredX - this.x[0], measuredY - this.x[1]];
    this.x[0] += K * innovation[0];
    this.x[1] += K * innovation[1];

    // 计算速度
    if (dt > 0) {
      this.x[2] = (innovation[0] / dt) * K + this.x[2] * (1 - K);
      this.x[3] = (innovation[1] / dt) * K + this.x[3] * (1 - K);
    }

    // 更新协方差
    for (let i = 0; i < 4; i++) {
      this.P[i][i] *= 1 - K;
    }

    return { x: this.x[0], y: this.x[1], vx: this.x[2], vy: this.x[3] };
  }

  reset(): void {
    this.x = [0, 0, 0, 0];
    this.P = [
      [1000, 0, 0, 0],
      [0, 1000, 0, 0],
      [0, 0, 1000, 0],
      [0, 0, 0, 1000],
    ];
    this.lastTimestamp = 0;
  }

  getState(): { x: number; y: number; vx: number; vy: number } {
    return { x: this.x[0], y: this.x[1], vx: this.x[2], vy: this.x[3] };
  }
}

/**
 * 透视变换计算器
 */
class PerspectiveTransform {
  private matrix: number[][] | null = null;
  private inverseMatrix: number[][] | null = null;

  /**
   * 从4个校准点计算透视变换矩阵
   * 校准点顺序: 左上、右上、右下、左下 (球场远端到近端)
   */
  setCalibration(points: CalibrationPoint[]): boolean {
    if (points.length !== 4) {
      return false;
    }

    // 目标点 (标准球场坐标，单位米)
    // 假设校准的是半场
    const dst = [
      { x: -COURT_DIMENSIONS.singles.halfWidth, y: COURT_DIMENSIONS.singles.halfLength }, // 左上 (远端)
      { x: COURT_DIMENSIONS.singles.halfWidth, y: COURT_DIMENSIONS.singles.halfLength }, // 右上 (远端)
      { x: COURT_DIMENSIONS.singles.halfWidth, y: 0 }, // 右下 (近端/网)
      { x: -COURT_DIMENSIONS.singles.halfWidth, y: 0 }, // 左下 (近端/网)
    ];

    // 源点 (屏幕坐标)
    const src = points.map((p) => ({ x: p.x, y: p.y }));

    // 计算透视变换矩阵 (使用简化的方法)
    this.matrix = this.computeHomography(src, dst);
    if (this.matrix) {
      this.inverseMatrix = this.computeHomography(dst, src);
    }

    return this.matrix !== null;
  }

  /**
   * 计算单应性矩阵 (简化版)
   */
  private computeHomography(
    src: { x: number; y: number }[],
    dst: { x: number; y: number }[]
  ): number[][] | null {
    if (src.length !== 4 || dst.length !== 4) {
      return null;
    }

    // 使用 4 点法计算透视变换
    // 这是一个简化实现，生产环境应使用 OpenCV 或更精确的算法

    // 构建方程组 Ah = b
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
      const sx = src[i].x;
      const sy = src[i].y;
      const dx = dst[i].x;
      const dy = dst[i].y;

      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      b.push(dx);
      b.push(dy);
    }

    // 求解线性方程组 (简化: 使用伪逆)
    const h = this.solveLinearSystem(A, b);
    if (!h) return null;

    // 构建 3x3 矩阵
    return [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], 1],
    ];
  }

  /**
   * 简单的线性方程组求解器
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] | null {
    const n = A.length;
    const m = A[0].length;

    // 使用高斯消元法 (带部分主元)
    const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < m && col < n; col++) {
      // 找主元
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row;
        }
      }

      // 交换行
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

      // 消元
      if (Math.abs(augmented[col][col]) < 1e-10) continue;

      for (let row = col + 1; row < n; row++) {
        const factor = augmented[row][col] / augmented[col][col];
        for (let j = col; j <= m; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }

    // 回代
    const x = new Array(m).fill(0);
    for (let i = Math.min(n, m) - 1; i >= 0; i--) {
      if (Math.abs(augmented[i][i]) < 1e-10) continue;
      x[i] = augmented[i][m];
      for (let j = i + 1; j < m; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  }

  /**
   * 屏幕坐标转球场坐标
   */
  screenToCourt(screenX: number, screenY: number): { x: number; y: number } | null {
    if (!this.matrix) {
      return null;
    }

    const m = this.matrix;
    const w = m[2][0] * screenX + m[2][1] * screenY + m[2][2];

    if (Math.abs(w) < 1e-10) {
      return null;
    }

    const courtX = (m[0][0] * screenX + m[0][1] * screenY + m[0][2]) / w;
    const courtY = (m[1][0] * screenX + m[1][1] * screenY + m[1][2]) / w;

    return { x: courtX, y: courtY };
  }

  /**
   * 球场坐标转屏幕坐标
   */
  courtToScreen(courtX: number, courtY: number): { x: number; y: number } | null {
    if (!this.inverseMatrix) {
      return null;
    }

    const m = this.inverseMatrix;
    const w = m[2][0] * courtX + m[2][1] * courtY + m[2][2];

    if (Math.abs(w) < 1e-10) {
      return null;
    }

    const screenX = (m[0][0] * courtX + m[0][1] * courtY + m[0][2]) / w;
    const screenY = (m[1][0] * courtX + m[1][1] * courtY + m[1][2]) / w;

    return { x: screenX, y: screenY };
  }

  isCalibrated(): boolean {
    return this.matrix !== null;
  }
}

/**
 * VisionHawkEye 主类
 * 管理网球检测、轨迹追踪和界内/出界判定
 */
export class VisionHawkEye {
  private kalmanFilter: KalmanFilter;
  private perspectiveTransform: PerspectiveTransform;
  private trajectory: TrajectoryPoint[] = [];
  private bounceEvents: BounceEvent[] = [];
  private lastDetection: BallDetection | null = null;
  private isTracking: boolean = false;
  private maxTrajectoryLength: number = 100;

  // 检测配置
  private config = {
    bounceVelocityThreshold: 50, // 速度变化阈值 (像素/秒)
    minBounceInterval: 200, // 最小落地间隔 (ms)
    lineThreshold: 50, // 压线判定阈值 (mm)
  };

  constructor() {
    this.kalmanFilter = new KalmanFilter();
    this.perspectiveTransform = new PerspectiveTransform();
  }

  /**
   * 设置校准点
   */
  setCalibration(points: CalibrationPoint[]): boolean {
    return this.perspectiveTransform.setCalibration(points);
  }

  /**
   * 处理一帧检测结果
   * 这个方法会被 Frame Processor 调用
   */
  processDetection(detection: BallDetection): HawkEyeAnalysis {
    this.isTracking = true;
    this.lastDetection = detection;

    // 使用 Kalman Filter 平滑轨迹
    const filtered = this.kalmanFilter.update(detection.x, detection.y, detection.timestamp);

    // 转换为球场坐标
    const courtPos = this.perspectiveTransform.screenToCourt(filtered.x, filtered.y);

    // 计算速度 (m/s)
    const speed = courtPos
      ? Math.sqrt(filtered.vx * filtered.vx + filtered.vy * filtered.vy) * 0.001 // 假设像素到米的转换
      : 0;

    // 创建轨迹点
    const point: TrajectoryPoint = {
      screenX: filtered.x,
      screenY: filtered.y,
      courtX: courtPos?.x ?? 0,
      courtY: courtPos?.y ?? 0,
      timestamp: detection.timestamp,
      velocity: { vx: filtered.vx, vy: filtered.vy },
      speed,
    };

    this.trajectory.push(point);

    // 限制轨迹长度
    if (this.trajectory.length > this.maxTrajectoryLength) {
      this.trajectory.shift();
    }

    // 检测落地
    this.detectBounce(point);

    return this.getAnalysis();
  }

  /**
   * 检测落地事件
   */
  private detectBounce(currentPoint: TrajectoryPoint): void {
    if (this.trajectory.length < 3) return;

    const prevPoint = this.trajectory[this.trajectory.length - 2];
    const prevPrevPoint = this.trajectory[this.trajectory.length - 3];

    // 检测速度方向变化 (特别是 y 方向)
    const vy1 = prevPoint.velocity.vy;
    const vy2 = currentPoint.velocity.vy;

    // 如果 y 速度从正变负或从负变正，可能是落地
    if (
      (vy1 > this.config.bounceVelocityThreshold && vy2 < -this.config.bounceVelocityThreshold) ||
      (vy1 < -this.config.bounceVelocityThreshold && vy2 > this.config.bounceVelocityThreshold)
    ) {
      // 检查与上一次落地的时间间隔
      const lastBounce = this.bounceEvents[this.bounceEvents.length - 1];
      if (
        lastBounce &&
        currentPoint.timestamp - lastBounce.timestamp < this.config.minBounceInterval
      ) {
        return;
      }

      // 判断是否在界内
      const { isIn, distance } = this.isInBounds(currentPoint.courtX, currentPoint.courtY);

      const bounceEvent: BounceEvent = {
        screenPosition: { x: currentPoint.screenX, y: currentPoint.screenY },
        courtPosition: { x: currentPoint.courtX, y: currentPoint.courtY },
        timestamp: currentPoint.timestamp,
        isInBounds: isIn,
        confidence: this.lastDetection?.confidence ?? 0,
        distanceFromLine: distance,
      };

      this.bounceEvents.push(bounceEvent);
    }
  }

  /**
   * 判断是否在界内
   * 返回是否在界内和距离边线的距离
   */
  private isInBounds(x: number, y: number): { isIn: boolean; distance: number } {
    const halfWidth = COURT_DIMENSIONS.singles.halfWidth;
    const halfLength = COURT_DIMENSIONS.singles.halfLength;

    // 计算到各边线的距离
    const distToLeft = x + halfWidth;
    const distToRight = halfWidth - x;
    const distToBottom = y;
    const distToTop = halfLength * 2 - y;

    // 最小距离
    const minDist = Math.min(distToLeft, distToRight, distToBottom, distToTop);

    // 转换为毫米
    const distanceMm = minDist * 1000;

    // 球在界内或压线 (网球规则：压线算界内)
    const isIn = x >= -halfWidth && x <= halfWidth && y >= 0 && y <= halfLength * 2;

    return { isIn, distance: distanceMm };
  }

  /**
   * 获取当前分析结果
   */
  getAnalysis(): HawkEyeAnalysis {
    // 计算平均球速 (km/h)
    let avgSpeed = 0;
    if (this.trajectory.length > 0) {
      const speeds = this.trajectory.map((p) => p.speed);
      avgSpeed = (speeds.reduce((a, b) => a + b, 0) / speeds.length) * 3.6; // m/s -> km/h
    }

    return {
      trajectory: [...this.trajectory],
      bounceEvents: [...this.bounceEvents],
      ballSpeed: avgSpeed,
      lastDetection: this.lastDetection,
      isTracking: this.isTracking,
    };
  }

  /**
   * 获取最后一个落地事件
   */
  getLastBounce(): BounceEvent | null {
    return this.bounceEvents[this.bounceEvents.length - 1] ?? null;
  }

  /**
   * 开始新的一分
   */
  startNewPoint(): void {
    this.trajectory = [];
    this.bounceEvents = [];
    this.kalmanFilter.reset();
    this.lastDetection = null;
    this.isTracking = false;
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.startNewPoint();
  }

  /**
   * 检查是否已校准
   */
  isCalibrated(): boolean {
    return this.perspectiveTransform.isCalibrated();
  }
}

// 导出单例
export const visionHawkEye = new VisionHawkEye();

export default VisionHawkEye;
