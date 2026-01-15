/**
 * 网球检测器
 *
 * 当前实现: 基于 HSV 颜色检测 (JavaScript)
 * 未来升级: CoreML YOLOv8 模型 (Native Frame Processor)
 *
 * 这个模块提供统一的检测接口，方便后续升级到 ML 模型
 */

import { BallDetection } from './visionHawkEye';

// 网球颜色范围 (HSV)
export const TENNIS_BALL_HSV = {
  // 标准黄绿色网球
  hue: { min: 25, max: 65 },
  saturation: { min: 80, max: 255 },
  value: { min: 80, max: 255 },
};

// 检测配置
export interface DetectorConfig {
  // 检测区域 (可以限制在球场范围内提高性能)
  roi?: { x: number; y: number; width: number; height: number };
  // 最小置信度阈值
  minConfidence: number;
  // 最小球大小 (像素)
  minBallSize: number;
  // 最大球大小 (像素)
  maxBallSize: number;
  // 使用 ML 模型 (未来启用)
  useML: boolean;
}

const DEFAULT_CONFIG: DetectorConfig = {
  minConfidence: 0.5,
  minBallSize: 10,
  maxBallSize: 200,
  useML: false, // 当前使用颜色检测
};

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
    h: Math.round(h * 180),
    s: Math.round(s * 255),
    v: Math.round(v * 255),
  };
}

/**
 * 检查颜色是否是网球颜色
 */
export function isTennisBallColor(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);
  return (
    hsv.h >= TENNIS_BALL_HSV.hue.min &&
    hsv.h <= TENNIS_BALL_HSV.hue.max &&
    hsv.s >= TENNIS_BALL_HSV.saturation.min &&
    hsv.s <= TENNIS_BALL_HSV.saturation.max &&
    hsv.v >= TENNIS_BALL_HSV.value.min &&
    hsv.v <= TENNIS_BALL_HSV.value.max
  );
}

/**
 * 候选区域
 */
interface Candidate {
  x: number;
  y: number;
  count: number;
}

/**
 * BallDetector 类
 * 提供统一的网球检测接口
 */
export class BallDetector {
  private config: DetectorConfig;
  private lastDetection: BallDetection | null = null;
  private frameCount: number = 0;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 从图像数据检测网球
   * @param imageData RGBA 图像数据
   * @param width 图像宽度
   * @param height 图像高度
   * @returns 检测到的球列表
   */
  detect(
    imageData: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
  ): BallDetection[] {
    this.frameCount++;
    const timestamp = Date.now();

    if (this.config.useML) {
      // 未来: 使用 CoreML 模型
      return this.detectWithML(imageData, width, height, timestamp);
    } else {
      // 当前: 使用颜色检测
      return this.detectWithColor(imageData, width, height, timestamp);
    }
  }

  /**
   * 基于颜色的检测
   */
  private detectWithColor(
    imageData: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    timestamp: number
  ): BallDetection[] {
    const candidates: Candidate[] = [];
    const gridSize = 16; // 降采样网格大小

    // 确定检测区域
    const roi = this.config.roi || { x: 0, y: 0, width, height };
    const startX = Math.max(0, roi.x);
    const startY = Math.max(0, roi.y);
    const endX = Math.min(width, roi.x + roi.width);
    const endY = Math.min(height, roi.y + roi.height);

    // 扫描图像
    for (let y = startY; y < endY; y += gridSize) {
      for (let x = startX; x < endX; x += gridSize) {
        let matchCount = 0;
        let totalChecked = 0;

        // 检查网格内的像素
        for (let dy = 0; dy < gridSize && y + dy < endY; dy += 2) {
          for (let dx = 0; dx < gridSize && x + dx < endX; dx += 2) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            const r = imageData[idx];
            const g = imageData[idx + 1];
            const b = imageData[idx + 2];

            totalChecked++;
            if (isTennisBallColor(r, g, b)) {
              matchCount++;
            }
          }
        }

        // 如果匹配率足够高，添加为候选
        if (totalChecked > 0 && matchCount / totalChecked > 0.3) {
          candidates.push({
            x: x + gridSize / 2,
            y: y + gridSize / 2,
            count: matchCount,
          });
        }
      }
    }

    // 聚类相邻候选点
    const clusters = this.clusterCandidates(candidates, gridSize * 2);
    const detections: BallDetection[] = [];

    for (const cluster of clusters) {
      if (cluster.length === 0) continue;

      // 计算聚类中心
      const avgX = cluster.reduce((sum, c) => sum + c.x, 0) / cluster.length;
      const avgY = cluster.reduce((sum, c) => sum + c.y, 0) / cluster.length;
      const totalCount = cluster.reduce((sum, c) => sum + c.count, 0);

      // 估计球的大小
      const size = Math.sqrt(cluster.length) * gridSize;

      // 检查大小是否在范围内
      if (size < this.config.minBallSize || size > this.config.maxBallSize) {
        continue;
      }

      // 计算置信度
      const confidence = Math.min(1, totalCount / (cluster.length * 20));

      if (confidence >= this.config.minConfidence) {
        detections.push({
          x: avgX,
          y: avgY,
          confidence,
          timestamp,
          frameWidth: width,
          frameHeight: height,
        });
      }
    }

    // 选择最佳检测结果
    if (detections.length > 0) {
      detections.sort((a, b) => b.confidence - a.confidence);
      this.lastDetection = detections[0];
    }

    return detections;
  }

  /**
   * 基于 ML 模型的检测 (占位符)
   */
  private detectWithML(
    _imageData: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    timestamp: number
  ): BallDetection[] {
    // TODO: 集成 CoreML YOLOv8 模型
    // 这需要:
    // 1. 创建 Swift Frame Processor 插件
    // 2. 加载 .mlmodel 文件
    // 3. 运行推理并返回结果

    console.warn('ML detection not yet implemented, falling back to color detection');
    return this.detectWithColor(_imageData, width, height, timestamp);
  }

  /**
   * 聚类候选点
   */
  private clusterCandidates(candidates: Candidate[], threshold: number): Candidate[][] {
    const clusters: Candidate[][] = [];
    const used = new Set<number>();

    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue;

      const cluster: Candidate[] = [candidates[i]];
      used.add(i);

      // BFS 找相邻点
      const queue = [i];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const currCandidate = candidates[curr];

        for (let j = 0; j < candidates.length; j++) {
          if (used.has(j)) continue;

          const dx = candidates[j].x - currCandidate.x;
          const dy = candidates[j].y - currCandidate.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < threshold) {
            cluster.push(candidates[j]);
            used.add(j);
            queue.push(j);
          }
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * 获取最后一次检测结果
   */
  getLastDetection(): BallDetection | null {
    return this.lastDetection;
  }

  /**
   * 获取帧计数
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.lastDetection = null;
    this.frameCount = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 启用/禁用 ML 检测
   */
  setUseML(useML: boolean): void {
    this.config.useML = useML;
  }
}

// 导出默认检测器实例
export const ballDetector = new BallDetector();

export default BallDetector;
