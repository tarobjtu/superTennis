/**
 * AI 鹰眼判定服务
 * 使用计算机视觉分析球落点，判定 IN/OUT
 */

import { CalibrationPoint } from '../stores/matchStore';

// 球落点判定结果
export interface BallLandingResult {
  isIn: boolean;
  confidence: number; // 0-100
  distanceFromLine: number; // 毫米，正数表示界内，负数表示出界
  landingPoint: { x: number; y: number };
  lineType: 'baseline' | 'sideline' | 'service' | 'center';
  timestamp: number;
}

// 球场边线定义（标准网球场尺寸，单位：米）
export const COURT_DIMENSIONS = {
  // 单打场地
  singles: {
    length: 23.77,  // 底线到底线
    width: 8.23,    // 单打边线到边线
  },
  // 双打场地
  doubles: {
    length: 23.77,
    width: 10.97,   // 双打边线到边线
  },
  // 发球区
  serviceBox: {
    length: 6.40,   // 发球线到网
    width: 4.115,   // 中线到边线
  },
  // 网高
  netHeight: {
    center: 0.914,
    posts: 1.07,
  },
};

// 边线类型
export type LineType = 'baseline' | 'sideline' | 'service_line' | 'center_line' | 'doubles_alley';

// 球场区域
export interface CourtZone {
  id: string;
  name: string;
  corners: { x: number; y: number }[];
  isValid: boolean; // 是否是有效落点区域
}

/**
 * 根据校准点计算球场透视变换矩阵
 */
export function calculatePerspectiveTransform(calibrationPoints: CalibrationPoint[]): number[][] {
  // 简化版透视变换
  // 实际应用中需要使用更复杂的算法（如 OpenCV 的 getPerspectiveTransform）

  if (calibrationPoints.length < 4) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  // 假设校准点按顺序：左上、右上、右下、左下
  const [tl, tr, br, bl] = calibrationPoints;

  // 计算缩放和偏移（简化版）
  const scaleX = COURT_DIMENSIONS.doubles.width / Math.abs(tr.x - tl.x);
  const scaleY = COURT_DIMENSIONS.doubles.length / Math.abs(bl.y - tl.y);

  return [
    [scaleX, 0, -tl.x * scaleX],
    [0, scaleY, -tl.y * scaleY],
    [0, 0, 1],
  ];
}

/**
 * 将屏幕坐标转换为球场坐标（米）
 */
export function screenToCourtCoordinates(
  screenPoint: { x: number; y: number },
  transform: number[][]
): { x: number; y: number } {
  const x = transform[0][0] * screenPoint.x + transform[0][1] * screenPoint.y + transform[0][2];
  const y = transform[1][0] * screenPoint.x + transform[1][1] * screenPoint.y + transform[1][2];
  return { x, y };
}

/**
 * 检查点是否在球场边界内
 */
export function isPointInBounds(
  point: { x: number; y: number },
  matchType: 'singles' | 'doubles' = 'singles'
): { isIn: boolean; distanceFromLine: number; lineType: LineType } {
  const court = matchType === 'singles' ? COURT_DIMENSIONS.singles : COURT_DIMENSIONS.doubles;

  const halfWidth = court.width / 2;
  const halfLength = court.length / 2;

  // 计算到各边线的距离
  const distToLeftLine = point.x + halfWidth;
  const distToRightLine = halfWidth - point.x;
  const distToTopLine = point.y + halfLength;
  const distToBottomLine = halfLength - point.y;

  // 找到最近的边线
  const distances = [
    { dist: distToLeftLine, type: 'sideline' as LineType },
    { dist: distToRightLine, type: 'sideline' as LineType },
    { dist: distToTopLine, type: 'baseline' as LineType },
    { dist: distToBottomLine, type: 'baseline' as LineType },
  ];

  const nearest = distances.reduce((min, curr) =>
    Math.abs(curr.dist) < Math.abs(min.dist) ? curr : min
  );

  // 判断是否在界内
  const isIn = point.x >= -halfWidth && point.x <= halfWidth &&
               point.y >= -halfLength && point.y <= halfLength;

  // 距离为正表示界内，负表示出界
  const distanceFromLine = isIn ? nearest.dist : -Math.abs(nearest.dist);

  return {
    isIn,
    distanceFromLine: distanceFromLine * 1000, // 转换为毫米
    lineType: nearest.type,
  };
}

/**
 * 检查发球是否有效
 */
export function isServeValid(
  landingPoint: { x: number; y: number },
  servingSide: 'deuce' | 'ad',
  serverSide: 'near' | 'far'
): { isIn: boolean; distanceFromLine: number } {
  const serviceBox = COURT_DIMENSIONS.serviceBox;

  // 根据发球方和接发方确定目标发球区
  let targetBox: { minX: number; maxX: number; minY: number; maxY: number };

  if (serverSide === 'near') {
    // 近端发球，目标在远端
    if (servingSide === 'deuce') {
      // Deuce 区（右侧发球，目标在对方左侧）
      targetBox = {
        minX: -serviceBox.width,
        maxX: 0,
        minY: 0,
        maxY: serviceBox.length,
      };
    } else {
      // Ad 区（左侧发球，目标在对方右侧）
      targetBox = {
        minX: 0,
        maxX: serviceBox.width,
        minY: 0,
        maxY: serviceBox.length,
      };
    }
  } else {
    // 远端发球，目标在近端
    if (servingSide === 'deuce') {
      targetBox = {
        minX: 0,
        maxX: serviceBox.width,
        minY: -serviceBox.length,
        maxY: 0,
      };
    } else {
      targetBox = {
        minX: -serviceBox.width,
        maxX: 0,
        minY: -serviceBox.length,
        maxY: 0,
      };
    }
  }

  const isIn = landingPoint.x >= targetBox.minX && landingPoint.x <= targetBox.maxX &&
               landingPoint.y >= targetBox.minY && landingPoint.y <= targetBox.maxY;

  // 计算到最近边线的距离
  const distances = [
    landingPoint.x - targetBox.minX,
    targetBox.maxX - landingPoint.x,
    landingPoint.y - targetBox.minY,
    targetBox.maxY - landingPoint.y,
  ];

  const minDist = Math.min(...distances);
  const distanceFromLine = isIn ? minDist * 1000 : -Math.abs(minDist) * 1000;

  return { isIn, distanceFromLine };
}

/**
 * 模拟 AI 分析（实际应用中会调用真实的 ML 模型）
 */
export async function analyzeFrame(
  imageUri: string,
  calibration: CalibrationPoint[] | null
): Promise<BallLandingResult | null> {
  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, 100));

  // 这里是模拟数据，实际应用中需要：
  // 1. 使用 TensorFlow Lite 或 Core ML 加载训练好的模型
  // 2. 对图像进行预处理
  // 3. 运行推理获取球的位置
  // 4. 结合校准数据计算实际落点

  // 模拟：随机生成一个落点
  const mockLandingPoint = {
    x: (Math.random() - 0.5) * 12, // -6 到 6 米
    y: (Math.random() - 0.5) * 26, // -13 到 13 米
  };

  const result = isPointInBounds(mockLandingPoint, 'singles');

  return {
    isIn: result.isIn,
    confidence: 75 + Math.random() * 20, // 75-95% 置信度
    distanceFromLine: result.distanceFromLine,
    landingPoint: mockLandingPoint,
    lineType: result.lineType as 'baseline' | 'sideline' | 'service' | 'center',
    timestamp: Date.now(),
  };
}

/**
 * 实时球追踪（用于连续帧分析）
 */
export class BallTracker {
  private positions: { x: number; y: number; timestamp: number }[] = [];
  private maxPositions = 30; // 保留最近30帧

  addPosition(x: number, y: number): void {
    this.positions.push({ x, y, timestamp: Date.now() });
    if (this.positions.length > this.maxPositions) {
      this.positions.shift();
    }
  }

  // 预测球的落点（基于抛物线轨迹）
  predictLandingPoint(): { x: number; y: number } | null {
    if (this.positions.length < 5) {
      return null;
    }

    // 简化版：使用最近几个点进行线性外推
    const recent = this.positions.slice(-5);

    // 计算平均速度
    const dx = (recent[4].x - recent[0].x) / 4;
    const dy = (recent[4].y - recent[0].y) / 4;

    // 假设球还需要移动一定距离才落地
    const extrapolationFactor = 3;

    return {
      x: recent[4].x + dx * extrapolationFactor,
      y: recent[4].y + dy * extrapolationFactor,
    };
  }

  // 检测球是否已落地（速度突然变化）
  detectBounce(): boolean {
    if (this.positions.length < 3) {
      return false;
    }

    const recent = this.positions.slice(-3);

    // 计算速度变化
    const v1 = {
      x: recent[1].x - recent[0].x,
      y: recent[1].y - recent[0].y,
    };
    const v2 = {
      x: recent[2].x - recent[1].x,
      y: recent[2].y - recent[1].y,
    };

    // 速度方向改变（尤其是 y 方向）可能表示落地反弹
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return false;
    }

    const cosAngle = dotProduct / (magnitude1 * magnitude2);

    // 如果角度变化大于90度，可能是落地反弹
    return cosAngle < 0;
  }

  clear(): void {
    this.positions = [];
  }
}

/**
 * 生成判定结果的可视化数据
 */
export function generateVisualization(
  result: BallLandingResult,
  courtWidth: number,
  courtHeight: number
): {
  ballPosition: { x: number; y: number };
  nearestLineStart: { x: number; y: number };
  nearestLineEnd: { x: number; y: number };
  distanceLineStart: { x: number; y: number };
  distanceLineEnd: { x: number; y: number };
} {
  // 将球场坐标转换为屏幕坐标
  const scaleX = courtWidth / COURT_DIMENSIONS.doubles.width;
  const scaleY = courtHeight / COURT_DIMENSIONS.doubles.length;

  const screenX = (result.landingPoint.x + COURT_DIMENSIONS.doubles.width / 2) * scaleX;
  const screenY = (result.landingPoint.y + COURT_DIMENSIONS.doubles.length / 2) * scaleY;

  // 根据最近边线类型计算线的位置
  let lineStart: { x: number; y: number };
  let lineEnd: { x: number; y: number };

  switch (result.lineType) {
    case 'baseline':
      lineStart = { x: 0, y: screenY > courtHeight / 2 ? courtHeight : 0 };
      lineEnd = { x: courtWidth, y: lineStart.y };
      break;
    case 'sideline':
      lineStart = { x: screenX > courtWidth / 2 ? courtWidth : 0, y: 0 };
      lineEnd = { x: lineStart.x, y: courtHeight };
      break;
    default:
      lineStart = { x: 0, y: 0 };
      lineEnd = { x: courtWidth, y: 0 };
  }

  return {
    ballPosition: { x: screenX, y: screenY },
    nearestLineStart: lineStart,
    nearestLineEnd: lineEnd,
    distanceLineStart: { x: screenX, y: screenY },
    distanceLineEnd: {
      x: result.lineType === 'sideline' ? lineStart.x : screenX,
      y: result.lineType === 'baseline' ? lineStart.y : screenY,
    },
  };
}

export default {
  analyzeFrame,
  isPointInBounds,
  isServeValid,
  calculatePerspectiveTransform,
  screenToCourtCoordinates,
  generateVisualization,
  BallTracker,
  COURT_DIMENSIONS,
};
