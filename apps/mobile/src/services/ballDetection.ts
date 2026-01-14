/**
 * 网球检测服务
 * 使用颜色阈值和轮廓检测来识别网球
 * 针对真实手机摄像头优化
 */

import { CalibrationPoint } from '../stores/matchStore';

// 网球的典型颜色范围 (HSV)
export const TENNIS_BALL_COLOR = {
  // 黄绿色网球
  hue: { min: 25, max: 65 },      // 黄色到绿色
  saturation: { min: 100, max: 255 }, // 高饱和度
  value: { min: 100, max: 255 },      // 中高亮度
};

// 检测参数
export const DETECTION_CONFIG = {
  // 最小/最大球的像素面积（根据距离调整）
  minBallArea: 100,
  maxBallArea: 10000,
  // 圆形度阈值（1.0 = 完美圆形）
  circularityThreshold: 0.6,
  // 运动检测阈值
  motionThreshold: 5,
  // 帧缓冲大小
  frameBufferSize: 10,
};

// 检测到的球
export interface DetectedBall {
  x: number;
  y: number;
  radius: number;
  confidence: number;
  velocity?: { vx: number; vy: number };
  timestamp: number;
}

// 帧分析结果
export interface FrameAnalysisResult {
  balls: DetectedBall[];
  processingTime: number;
  frameWidth: number;
  frameHeight: number;
}

/**
 * RGB 转 HSV
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 180), // 0-180 (OpenCV convention)
    s: Math.round(s * 255),
    v: Math.round(v * 255),
  };
}

/**
 * 检查像素是否是网球颜色
 */
export function isTennisBallColor(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);

  return (
    hsv.h >= TENNIS_BALL_COLOR.hue.min &&
    hsv.h <= TENNIS_BALL_COLOR.hue.max &&
    hsv.s >= TENNIS_BALL_COLOR.saturation.min &&
    hsv.s <= TENNIS_BALL_COLOR.saturation.max &&
    hsv.v >= TENNIS_BALL_COLOR.value.min &&
    hsv.v <= TENNIS_BALL_COLOR.value.max
  );
}

/**
 * 球轨迹追踪器
 */
export class RealTimeBallTracker {
  private detectionHistory: DetectedBall[] = [];
  private frameCount = 0;
  private lastProcessTime = 0;
  private fps = 0;

  // 性能统计
  private processingTimes: number[] = [];
  private maxHistorySize = 30;

  /**
   * 处理摄像头帧数据
   * 注意：在 React Native 中，我们需要使用 native module 来处理图像
   * 这里提供 JavaScript 层的接口
   */
  async processFrame(
    imageData: { data: Uint8Array; width: number; height: number } | null,
    calibration: CalibrationPoint[] | null
  ): Promise<FrameAnalysisResult> {
    const startTime = performance.now();
    this.frameCount++;

    // 如果没有图像数据，返回空结果
    if (!imageData) {
      return {
        balls: [],
        processingTime: 0,
        frameWidth: 0,
        frameHeight: 0,
      };
    }

    const { data, width, height } = imageData;
    const balls: DetectedBall[] = [];

    // 简化版球检测：扫描图像寻找网球颜色的区域
    // 实际应用中应使用 native 模块进行高效处理
    const candidates: { x: number; y: number; count: number }[] = [];
    const gridSize = 20; // 降低分辨率以提高性能

    for (let y = 0; y < height; y += gridSize) {
      for (let x = 0; x < width; x += gridSize) {
        let matchCount = 0;

        // 检查 grid 区域内的像素
        for (let dy = 0; dy < gridSize && y + dy < height; dy += 2) {
          for (let dx = 0; dx < gridSize && x + dx < width; dx += 2) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            if (isTennisBallColor(r, g, b)) {
              matchCount++;
            }
          }
        }

        // 如果区域内有足够的匹配像素
        if (matchCount > (gridSize * gridSize) / 16) {
          candidates.push({ x: x + gridSize / 2, y: y + gridSize / 2, count: matchCount });
        }
      }
    }

    // 聚类相邻的候选点
    const clusters = this.clusterCandidates(candidates, gridSize * 2);

    // 为每个聚类创建检测结果
    for (const cluster of clusters) {
      const avgX = cluster.reduce((sum, c) => sum + c.x, 0) / cluster.length;
      const avgY = cluster.reduce((sum, c) => sum + c.y, 0) / cluster.length;
      const totalCount = cluster.reduce((sum, c) => sum + c.count, 0);

      // 估计球的半径
      const radius = Math.sqrt(cluster.length) * gridSize / 2;

      // 计算置信度
      const confidence = Math.min(100, (totalCount / (cluster.length * gridSize)) * 100);

      // 计算速度（如果有历史数据）
      let velocity: { vx: number; vy: number } | undefined;
      if (this.detectionHistory.length > 0) {
        const lastBall = this.detectionHistory[this.detectionHistory.length - 1];
        const dt = (Date.now() - lastBall.timestamp) / 1000; // 秒
        if (dt > 0 && dt < 0.5) { // 合理的时间间隔
          velocity = {
            vx: (avgX - lastBall.x) / dt,
            vy: (avgY - lastBall.y) / dt,
          };
        }
      }

      const detectedBall: DetectedBall = {
        x: avgX,
        y: avgY,
        radius,
        confidence,
        velocity,
        timestamp: Date.now(),
      };

      balls.push(detectedBall);
    }

    // 更新历史记录
    if (balls.length > 0) {
      // 选择置信度最高的球
      const bestBall = balls.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      this.addToHistory(bestBall);
    }

    const processingTime = performance.now() - startTime;
    this.updateFPS(processingTime);

    return {
      balls,
      processingTime,
      frameWidth: width,
      frameHeight: height,
    };
  }

  /**
   * 聚类相邻的候选点
   */
  private clusterCandidates(
    candidates: { x: number; y: number; count: number }[],
    threshold: number
  ): { x: number; y: number; count: number }[][] {
    const clusters: { x: number; y: number; count: number }[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;

      const cluster: { x: number; y: number; count: number }[] = [candidates[i]];
      used.add(i);

      // 找到所有相邻的候选点
      for (let j = i + 1; j < candidates.length; j++) {
        if (used.has(j)) continue;

        const dx = candidates[j].x - candidates[i].x;
        const dy = candidates[j].y - candidates[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < threshold) {
          cluster.push(candidates[j]);
          used.add(j);
        }
      }

      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * 添加检测结果到历史
   */
  private addToHistory(ball: DetectedBall): void {
    this.detectionHistory.push(ball);
    if (this.detectionHistory.length > this.maxHistorySize) {
      this.detectionHistory.shift();
    }
  }

  /**
   * 更新 FPS 计算
   */
  private updateFPS(processingTime: number): void {
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 30) {
      this.processingTimes.shift();
    }

    const now = performance.now();
    if (now - this.lastProcessTime >= 1000) {
      this.fps = Math.round(1000 / (this.getAverageProcessingTime() || 33));
      this.lastProcessTime = now;
    }
  }

  /**
   * 获取平均处理时间
   */
  getAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0;
    return this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }

  /**
   * 获取当前 FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * 获取检测历史
   */
  getHistory(): DetectedBall[] {
    return [...this.detectionHistory];
  }

  /**
   * 预测球的落点
   */
  predictLandingPoint(): { x: number; y: number; confidence: number } | null {
    if (this.detectionHistory.length < 3) {
      return null;
    }

    const recent = this.detectionHistory.slice(-5);

    // 计算平均速度
    let totalVx = 0;
    let totalVy = 0;
    let count = 0;

    for (const ball of recent) {
      if (ball.velocity) {
        totalVx += ball.velocity.vx;
        totalVy += ball.velocity.vy;
        count++;
      }
    }

    if (count === 0) return null;

    const avgVx = totalVx / count;
    const avgVy = totalVy / count;

    // 预测未来位置（假设 0.5 秒后）
    const lastBall = this.detectionHistory[this.detectionHistory.length - 1];
    const predictedX = lastBall.x + avgVx * 0.5;
    const predictedY = lastBall.y + avgVy * 0.5;

    // 置信度基于速度的一致性
    const velocityConsistency = Math.min(100, 100 - Math.abs(avgVx - (recent[recent.length - 1].velocity?.vx || 0)));

    return {
      x: predictedX,
      y: predictedY,
      confidence: velocityConsistency,
    };
  }

  /**
   * 检测落地事件
   */
  detectBounce(): { detected: boolean; position?: { x: number; y: number } } {
    if (this.detectionHistory.length < 5) {
      return { detected: false };
    }

    const recent = this.detectionHistory.slice(-5);

    // 检查速度方向变化（特别是 y 方向）
    for (let i = 1; i < recent.length - 1; i++) {
      const v1 = recent[i].velocity;
      const v2 = recent[i + 1].velocity;

      if (v1 && v2) {
        // 如果 y 速度从正变负或从负变正，可能是落地
        if ((v1.vy > 0 && v2.vy < 0) || (v1.vy < 0 && v2.vy > 0)) {
          // 速度变化足够大才认为是落地
          if (Math.abs(v2.vy - v1.vy) > 100) {
            return {
              detected: true,
              position: { x: recent[i + 1].x, y: recent[i + 1].y },
            };
          }
        }
      }
    }

    return { detected: false };
  }

  /**
   * 重置追踪器
   */
  reset(): void {
    this.detectionHistory = [];
    this.frameCount = 0;
    this.processingTimes = [];
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): {
    frameCount: number;
    historySize: number;
    fps: number;
    avgProcessingTime: number;
  } {
    return {
      frameCount: this.frameCount,
      historySize: this.detectionHistory.length,
      fps: this.fps,
      avgProcessingTime: this.getAverageProcessingTime(),
    };
  }
}

// 导出单例实例
export const ballTracker = new RealTimeBallTracker();

export default {
  RealTimeBallTracker,
  ballTracker,
  rgbToHsv,
  isTennisBallColor,
  TENNIS_BALL_COLOR,
  DETECTION_CONFIG,
};
