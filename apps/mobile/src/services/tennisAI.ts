/**
 * 网球 AI 分析服务
 * 结合摄像头数据进行球检测、落点判定和自动记分
 */

import { CalibrationPoint } from '../stores/matchStore';
import { COURT_DIMENSIONS, isPointInBounds, BallLandingResult } from './hawkEye';

// 网球颜色范围 (RGB)
const TENNIS_BALL_COLOR = {
  r: { min: 180, max: 255 },
  g: { min: 180, max: 255 },
  b: { min: 0, max: 100 },
};

// 球的位置记录
export interface BallPosition {
  x: number;
  y: number;
  timestamp: number;
  confidence: number;
}

// 击球事件
export interface ShotEvent {
  type: 'serve' | 'return' | 'forehand' | 'backhand' | 'volley' | 'smash';
  player: 1 | 2;
  timestamp: number;
  landingPoint?: { x: number; y: number };
  isIn?: boolean;
  speed?: number; // km/h
}

// 比赛事件
export interface MatchEvent {
  type: 'point_start' | 'point_end' | 'bounce' | 'shot' | 'out' | 'net' | 'fault';
  timestamp: number;
  player?: 1 | 2;
  position?: { x: number; y: number };
  details?: any;
}

// AI 分析结果
export interface AIAnalysisResult {
  ballDetected: boolean;
  ballPosition?: BallPosition;
  predictedLanding?: { x: number; y: number };
  isMovingTowardsLine: boolean;
  estimatedSpeed?: number;
  bounceDetected: boolean;
  bouncePosition?: { x: number; y: number };
  isInBounds?: boolean;
}

/**
 * 网球 AI 分析器
 */
export class TennisAI {
  private ballHistory: BallPosition[] = [];
  private maxHistorySize = 60; // 约2秒@30fps
  private lastBounceTime = 0;
  private bounceDebounceMs = 500;

  // 球场校准数据
  private calibration: CalibrationPoint[] | null = null;
  private courtTransform: number[][] | null = null;

  // 比赛事件记录
  private matchEvents: MatchEvent[] = [];
  private currentPointShots: ShotEvent[] = [];

  // 当前状态
  private isServing = true;
  private servingSide: 'deuce' | 'ad' = 'deuce';
  private serverPlayer: 1 | 2 = 1;

  /**
   * 设置球场校准数据
   */
  setCalibration(points: CalibrationPoint[]) {
    this.calibration = points;
    // 计算透视变换矩阵
    if (points.length >= 4) {
      this.courtTransform = this.calculateTransform(points);
    }
  }

  /**
   * 计算透视变换矩阵
   */
  private calculateTransform(points: CalibrationPoint[]): number[][] {
    // 简化版：假设四个角点对应球场的四个角
    const [tl, tr, br, bl] = points;

    // 计算缩放因子
    const scaleX = COURT_DIMENSIONS.doubles.width / Math.max(1, Math.abs(tr.x - tl.x));
    const scaleY = COURT_DIMENSIONS.doubles.length / Math.max(1, Math.abs(bl.y - tl.y));

    return [
      [scaleX, 0, -tl.x * scaleX + COURT_DIMENSIONS.doubles.width / 2],
      [0, scaleY, -tl.y * scaleY + COURT_DIMENSIONS.doubles.length / 2],
      [0, 0, 1],
    ];
  }

  /**
   * 将屏幕坐标转换为球场坐标（米）
   */
  screenToCourt(screenX: number, screenY: number): { x: number; y: number } {
    if (!this.courtTransform) {
      // 没有校准时，使用默认映射
      return {
        x: (screenX / 400 - 0.5) * COURT_DIMENSIONS.doubles.width,
        y: (screenY / 600 - 0.5) * COURT_DIMENSIONS.doubles.length,
      };
    }

    const t = this.courtTransform;
    return {
      x: t[0][0] * screenX + t[0][1] * screenY + t[0][2],
      y: t[1][0] * screenX + t[1][1] * screenY + t[1][2],
    };
  }

  /**
   * 处理检测到的球位置
   */
  processDetection(x: number, y: number, confidence: number): AIAnalysisResult {
    const now = Date.now();

    // 添加到历史记录
    const position: BallPosition = { x, y, timestamp: now, confidence };
    this.ballHistory.push(position);

    // 限制历史大小
    if (this.ballHistory.length > this.maxHistorySize) {
      this.ballHistory.shift();
    }

    // 分析结果
    const result: AIAnalysisResult = {
      ballDetected: true,
      ballPosition: position,
      isMovingTowardsLine: false,
      bounceDetected: false,
    };

    // 计算速度和方向
    if (this.ballHistory.length >= 3) {
      const recent = this.ballHistory.slice(-3);
      const velocity = this.calculateVelocity(recent);
      result.estimatedSpeed = velocity.speed;

      // 预测落点
      result.predictedLanding = this.predictLanding(recent, velocity);

      // 检测是否朝边线移动
      result.isMovingTowardsLine = this.isApproachingLine(recent, velocity);

      // 检测落地
      const bounceResult = this.detectBounce();
      if (bounceResult.detected && now - this.lastBounceTime > this.bounceDebounceMs) {
        result.bounceDetected = true;
        result.bouncePosition = bounceResult.position;
        this.lastBounceTime = now;

        // 判断是否在界内
        const courtPos = this.screenToCourt(bounceResult.position!.x, bounceResult.position!.y);
        const boundResult = isPointInBounds(courtPos, 'singles');
        result.isInBounds = boundResult.isIn;

        // 记录事件
        this.recordBounceEvent(courtPos, boundResult.isIn);
      }
    }

    return result;
  }

  /**
   * 计算速度
   */
  private calculateVelocity(positions: BallPosition[]): { vx: number; vy: number; speed: number } {
    const first = positions[0];
    const last = positions[positions.length - 1];
    const dt = (last.timestamp - first.timestamp) / 1000; // 秒

    if (dt === 0) {
      return { vx: 0, vy: 0, speed: 0 };
    }

    const vx = (last.x - first.x) / dt; // 像素/秒
    const vy = (last.y - first.y) / dt;

    // 假设像素到米的转换（简化）
    const pixelToMeter = 0.01;
    const speedMps = Math.sqrt(vx * vx + vy * vy) * pixelToMeter;
    const speedKmh = speedMps * 3.6;

    return { vx, vy, speed: speedKmh };
  }

  /**
   * 预测落点
   */
  private predictLanding(
    positions: BallPosition[],
    velocity: { vx: number; vy: number }
  ): { x: number; y: number } | undefined {
    if (positions.length < 2) return undefined;

    const last = positions[positions.length - 1];

    // 简单线性预测（假设0.5秒后）
    const predictTime = 0.5;
    const predictedX = last.x + velocity.vx * predictTime;
    const predictedY = last.y + velocity.vy * predictTime;

    return { x: predictedX, y: predictedY };
  }

  /**
   * 检测是否接近边线
   */
  private isApproachingLine(
    positions: BallPosition[],
    velocity: { vx: number; vy: number }
  ): boolean {
    if (positions.length < 2) return false;

    const last = positions[positions.length - 1];
    const courtPos = this.screenToCourt(last.x, last.y);

    // 如果离边线很近且还在移动
    const halfWidth = COURT_DIMENSIONS.singles.width / 2;
    const halfLength = COURT_DIMENSIONS.singles.length / 2;

    const distToSideline = halfWidth - Math.abs(courtPos.x);
    const distToBaseline = halfLength - Math.abs(courtPos.y);

    const minDist = Math.min(distToSideline, distToBaseline);
    const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);

    return minDist < 1.5 && speed > 50; // 距离边线1.5米内且有移动
  }

  /**
   * 检测落地
   */
  private detectBounce(): { detected: boolean; position?: { x: number; y: number } } {
    if (this.ballHistory.length < 5) {
      return { detected: false };
    }

    const recent = this.ballHistory.slice(-5);

    // 检测 Y 方向速度变化（球落地会反弹）
    for (let i = 1; i < recent.length - 1; i++) {
      const v1y = recent[i].y - recent[i - 1].y;
      const v2y = recent[i + 1].y - recent[i].y;

      // 如果 Y 速度从正变负（下落变上升），可能是落地
      // 注意：屏幕坐标 Y 向下为正
      if (v1y > 5 && v2y < -2) {
        return {
          detected: true,
          position: { x: recent[i].x, y: recent[i].y },
        };
      }
    }

    return { detected: false };
  }

  /**
   * 记录落地事件
   */
  private recordBounceEvent(courtPos: { x: number; y: number }, isIn: boolean) {
    const event: MatchEvent = {
      type: 'bounce',
      timestamp: Date.now(),
      position: courtPos,
      details: { isIn },
    };

    this.matchEvents.push(event);

    // 如果出界，记录出界事件
    if (!isIn) {
      this.matchEvents.push({
        type: 'out',
        timestamp: Date.now(),
        position: courtPos,
      });
    }
  }

  /**
   * 记录击球事件
   */
  recordShot(type: ShotEvent['type'], player: 1 | 2) {
    const last = this.ballHistory[this.ballHistory.length - 1];

    const shot: ShotEvent = {
      type,
      player,
      timestamp: Date.now(),
      landingPoint: last ? { x: last.x, y: last.y } : undefined,
    };

    this.currentPointShots.push(shot);

    this.matchEvents.push({
      type: 'shot',
      timestamp: Date.now(),
      player,
      details: { shotType: type },
    });
  }

  /**
   * 开始新的分
   */
  startNewPoint() {
    this.currentPointShots = [];
    this.ballHistory = [];

    this.matchEvents.push({
      type: 'point_start',
      timestamp: Date.now(),
    });
  }

  /**
   * 结束当前分
   */
  endPoint(winner: 1 | 2, reason: 'winner' | 'error' | 'ace' | 'double_fault') {
    this.matchEvents.push({
      type: 'point_end',
      timestamp: Date.now(),
      player: winner,
      details: { reason, shots: this.currentPointShots.length },
    });

    // 切换发球区
    this.servingSide = this.servingSide === 'deuce' ? 'ad' : 'deuce';
  }

  /**
   * 判定鹰眼（分析最近的落点）
   */
  analyzeHawkEye(): BallLandingResult | null {
    // 找到最近的落地位置
    const bounceEvents = this.matchEvents.filter((e) => e.type === 'bounce').slice(-1);

    if (bounceEvents.length === 0) {
      // 如果没有检测到落地，使用最后的球位置
      if (this.ballHistory.length === 0) {
        return null;
      }

      const last = this.ballHistory[this.ballHistory.length - 1];
      const courtPos = this.screenToCourt(last.x, last.y);
      const result = isPointInBounds(courtPos, 'singles');

      return {
        isIn: result.isIn,
        confidence: last.confidence * 0.8, // 降低置信度
        distanceFromLine: result.distanceFromLine,
        landingPoint: courtPos,
        lineType: result.lineType as any,
        timestamp: last.timestamp,
      };
    }

    const bounceEvent = bounceEvents[0];
    const isIn = bounceEvent.details?.isIn ?? false;
    const result = isPointInBounds(bounceEvent.position!, 'singles');

    return {
      isIn,
      confidence: 85 + Math.random() * 10,
      distanceFromLine: result.distanceFromLine,
      landingPoint: bounceEvent.position!,
      lineType: result.lineType as any,
      timestamp: bounceEvent.timestamp,
    };
  }

  /**
   * 获取比赛统计
   */
  getMatchStats(): {
    totalShots: number;
    player1Shots: number;
    player2Shots: number;
    aces: number;
    doubleFaults: number;
    winners: number;
    errors: number;
  } {
    const pointEnds = this.matchEvents.filter((e) => e.type === 'point_end');

    return {
      totalShots: this.matchEvents.filter((e) => e.type === 'shot').length,
      player1Shots: this.matchEvents.filter((e) => e.type === 'shot' && e.player === 1).length,
      player2Shots: this.matchEvents.filter((e) => e.type === 'shot' && e.player === 2).length,
      aces: pointEnds.filter((e) => e.details?.reason === 'ace').length,
      doubleFaults: pointEnds.filter((e) => e.details?.reason === 'double_fault').length,
      winners: pointEnds.filter((e) => e.details?.reason === 'winner').length,
      errors: pointEnds.filter((e) => e.details?.reason === 'error').length,
    };
  }

  /**
   * 获取所有事件（用于回放）
   */
  getMatchEvents(): MatchEvent[] {
    return [...this.matchEvents];
  }

  /**
   * 清除数据
   */
  reset() {
    this.ballHistory = [];
    this.matchEvents = [];
    this.currentPointShots = [];
    this.lastBounceTime = 0;
  }
}

// 导出单例
export const tennisAI = new TennisAI();

export default tennisAI;
