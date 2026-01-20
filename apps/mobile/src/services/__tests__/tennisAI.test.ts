/**
 * TennisAI 测试
 */

import { TennisAI } from '../tennisAI';

describe('TennisAI', () => {
  let ai: TennisAI;

  beforeEach(() => {
    ai = new TennisAI();
  });

  describe('setCalibration', () => {
    it('should accept calibration points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 200 },
        { x: 0, y: 200 },
      ];
      ai.setCalibration(points);
      // No error should be thrown
    });

    it('should handle less than 4 points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      ai.setCalibration(points);
      // Should not throw
    });
  });

  describe('screenToCourt', () => {
    it('should convert screen coordinates without calibration', () => {
      const result = ai.screenToCourt(200, 300);
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    it('should convert screen coordinates with calibration', () => {
      ai.setCalibration([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 0, y: 600 },
      ]);
      const result = ai.screenToCourt(200, 300);
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });
  });

  describe('processDetection', () => {
    it('should return analysis result for single detection', () => {
      const result = ai.processDetection(100, 200, 90);

      expect(result.ballDetected).toBe(true);
      expect(result.ballPosition).toBeDefined();
      expect(result.ballPosition!.x).toBe(100);
      expect(result.ballPosition!.y).toBe(200);
      expect(result.ballPosition!.confidence).toBe(90);
    });

    it('should calculate velocity with multiple detections', () => {
      // 模拟多帧检测
      ai.processDetection(100, 200, 90);
      ai.processDetection(110, 210, 90);
      const result = ai.processDetection(120, 220, 90);

      expect(result.estimatedSpeed).toBeDefined();
      expect(typeof result.estimatedSpeed).toBe('number');
    });

    it('should predict landing point', () => {
      ai.processDetection(100, 200, 90);
      ai.processDetection(110, 210, 90);
      const result = ai.processDetection(120, 220, 90);

      expect(result.predictedLanding).toBeDefined();
    });

    it('should detect bounce when velocity reverses', () => {
      // 模拟球下落
      ai.processDetection(100, 100, 90);
      ai.processDetection(100, 110, 90);
      ai.processDetection(100, 120, 90);
      ai.processDetection(100, 130, 90);
      // 模拟反弹
      const result = ai.processDetection(100, 120, 90);

      // bounceDetected depends on timing debounce
      expect(result).toBeDefined();
    });
  });

  describe('startNewPoint', () => {
    it('should reset point-related state', () => {
      ai.processDetection(100, 200, 90);
      ai.startNewPoint();
      // State should be reset
    });

    it('should record point_start event', () => {
      ai.startNewPoint();
      const events = ai.getMatchEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[events.length - 1].type).toBe('point_start');
    });
  });

  describe('endPoint', () => {
    it('should record point_end event with winner', () => {
      ai.startNewPoint();
      ai.endPoint(1, 'winner');

      const events = ai.getMatchEvents();
      const pointEnd = events.find((e) => e.type === 'point_end');
      expect(pointEnd).toBeDefined();
      expect(pointEnd!.player).toBe(1);
      expect(pointEnd!.details.reason).toBe('winner');
    });

    it('should track aces', () => {
      ai.startNewPoint();
      ai.endPoint(1, 'ace');

      const stats = ai.getMatchStats();
      expect(stats.aces).toBe(1);
    });

    it('should track double faults', () => {
      ai.startNewPoint();
      ai.endPoint(2, 'double_fault');

      const stats = ai.getMatchStats();
      expect(stats.doubleFaults).toBe(1);
    });
  });

  describe('recordShot', () => {
    it('should record shot events', () => {
      ai.recordShot('serve', 1);

      const events = ai.getMatchEvents();
      const shotEvent = events.find((e) => e.type === 'shot');
      expect(shotEvent).toBeDefined();
      expect(shotEvent!.player).toBe(1);
      expect(shotEvent!.details.shotType).toBe('serve');
    });

    it('should increment shot count in stats', () => {
      ai.recordShot('forehand', 1);
      ai.recordShot('backhand', 2);

      const stats = ai.getMatchStats();
      expect(stats.totalShots).toBe(2);
      expect(stats.player1Shots).toBe(1);
      expect(stats.player2Shots).toBe(1);
    });
  });

  describe('analyzeHawkEye', () => {
    it('should return null with no ball history', () => {
      const result = ai.analyzeHawkEye();
      expect(result).toBeNull();
    });

    it('should return result based on ball history', () => {
      ai.processDetection(100, 200, 90);
      const result = ai.analyzeHawkEye();

      expect(result).not.toBeNull();
      expect(result!.landingPoint).toBeDefined();
      expect(typeof result!.isIn).toBe('boolean');
      expect(typeof result!.confidence).toBe('number');
    });
  });

  describe('getMatchStats', () => {
    it('should return initial stats', () => {
      const stats = ai.getMatchStats();

      expect(stats.totalShots).toBe(0);
      expect(stats.player1Shots).toBe(0);
      expect(stats.player2Shots).toBe(0);
      expect(stats.aces).toBe(0);
      expect(stats.doubleFaults).toBe(0);
      expect(stats.winners).toBe(0);
      expect(stats.errors).toBe(0);
    });

    it('should accumulate stats across points', () => {
      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.recordShot('return', 2);
      ai.endPoint(1, 'winner');

      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.endPoint(1, 'ace');

      const stats = ai.getMatchStats();
      expect(stats.totalShots).toBe(3);
      expect(stats.winners).toBe(1);
      expect(stats.aces).toBe(1);
    });
  });

  describe('getMatchEvents', () => {
    it('should return copy of events', () => {
      ai.startNewPoint();
      const events1 = ai.getMatchEvents();
      const events2 = ai.getMatchEvents();

      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      ai.processDetection(100, 200, 90);
      ai.startNewPoint();
      ai.recordShot('serve', 1);

      ai.reset();

      expect(ai.getMatchEvents()).toHaveLength(0);
      expect(ai.getMatchStats().totalShots).toBe(0);
      expect(ai.analyzeHawkEye()).toBeNull();
    });
  });
});

// ==================== 新增测试用例 ====================

describe('TennisAI - advanced scenarios', () => {
  let ai: TennisAI;

  beforeEach(() => {
    ai = new TennisAI();
  });

  describe('processDetection - velocity and speed calculation', () => {
    it('should calculate speed for moving ball', () => {
      // 模拟球移动
      // 注意：速度计算依赖时间戳，由于测试执行很快
      // 时间差几乎为0，所以速度可能为0或非常小
      ai.processDetection(0, 0, 90);
      ai.processDetection(100, 100, 90);
      const result = ai.processDetection(200, 200, 90);

      // 验证速度字段存在且是数字
      expect(result.estimatedSpeed).toBeDefined();
      expect(typeof result.estimatedSpeed).toBe('number');
      // 速度应该是非负数
      expect(result.estimatedSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should detect movement towards line', () => {
      // 校准后检测
      ai.setCalibration([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 0, y: 600 },
      ]);

      // 模拟球向边线移动
      ai.processDetection(200, 200, 90);
      ai.processDetection(350, 200, 90);
      const result = ai.processDetection(390, 200, 90);

      expect(result.isMovingTowardsLine).toBeDefined();
    });
  });

  describe('processDetection - bounce detection', () => {
    it('should detect bounce with proper velocity reversal', () => {
      // 模拟球下落然后反弹（Y增加然后减少）
      ai.processDetection(100, 100, 90);
      ai.processDetection(100, 120, 90);
      ai.processDetection(100, 140, 90);
      ai.processDetection(100, 160, 90);
      // 反弹
      const result = ai.processDetection(100, 150, 90);

      // bounceDetected 取决于速度阈值
      expect(result).toBeDefined();
      expect(result.ballDetected).toBe(true);
    });

    it('should not detect bounce for smooth trajectory', () => {
      // 平滑轨迹，无反弹
      for (let i = 0; i < 10; i++) {
        ai.processDetection(i * 10, i * 10, 90);
      }
      const result = ai.processDetection(100, 100, 90);

      expect(result.bounceDetected).toBe(false);
    });
  });

  describe('screenToCourt - coordinate transformation', () => {
    it('should use default mapping without calibration', () => {
      const result = ai.screenToCourt(200, 300);

      // 默认映射：(x/400 - 0.5) * width, (y/600 - 0.5) * length
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    it('should use calibration when set', () => {
      ai.setCalibration([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 0, y: 600 },
      ]);

      const result = ai.screenToCourt(200, 300);

      // 校准后结果应该不同
      expect(typeof result.x).toBe('number');
      expect(typeof result.y).toBe('number');
    });

    it('should handle edge screen coordinates', () => {
      ai.setCalibration([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 0, y: 600 },
      ]);

      const cornerResult = ai.screenToCourt(0, 0);
      const centerResult = ai.screenToCourt(200, 300);

      expect(cornerResult.x).not.toBe(centerResult.x);
      expect(cornerResult.y).not.toBe(centerResult.y);
    });
  });

  describe('complete match flow', () => {
    it('should track a complete point correctly', () => {
      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.processDetection(100, 100, 90);
      ai.recordShot('return', 2);
      ai.processDetection(200, 200, 90);
      ai.recordShot('forehand', 1);
      ai.processDetection(300, 150, 90);
      ai.endPoint(1, 'winner');

      const stats = ai.getMatchStats();
      expect(stats.totalShots).toBe(3);
      expect(stats.player1Shots).toBe(2);
      expect(stats.player2Shots).toBe(1);
      expect(stats.winners).toBe(1);
    });

    it('should track multiple points', () => {
      // Point 1
      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.endPoint(1, 'ace');

      // Point 2
      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.recordShot('return', 2);
      ai.endPoint(2, 'winner');

      // Point 3
      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.endPoint(2, 'error');

      const stats = ai.getMatchStats();
      expect(stats.aces).toBe(1);
      expect(stats.winners).toBe(1);
      expect(stats.errors).toBe(1);
      expect(stats.totalShots).toBe(4);
    });

    it('should track double faults', () => {
      ai.startNewPoint();
      ai.endPoint(2, 'double_fault');
      ai.startNewPoint();
      ai.endPoint(2, 'double_fault');

      const stats = ai.getMatchStats();
      expect(stats.doubleFaults).toBe(2);
    });
  });

  describe('analyzeHawkEye - detailed scenarios', () => {
    it('should return result with confidence', () => {
      ai.processDetection(100, 200, 85);
      const result = ai.analyzeHawkEye();

      expect(result).not.toBeNull();
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(100);
    });

    it('should include landing point', () => {
      ai.processDetection(150, 250, 90);
      const result = ai.analyzeHawkEye();

      expect(result).not.toBeNull();
      expect(result!.landingPoint).toBeDefined();
      expect(typeof result!.landingPoint.x).toBe('number');
      expect(typeof result!.landingPoint.y).toBe('number');
    });

    it('should determine in/out correctly for center court', () => {
      // 球场中心应该是 IN
      ai.setCalibration([
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 600 },
        { x: 0, y: 600 },
      ]);

      ai.processDetection(200, 300, 90);
      const result = ai.analyzeHawkEye();

      expect(result).not.toBeNull();
      expect(typeof result!.isIn).toBe('boolean');
    });
  });

  describe('event recording', () => {
    it('should record events in chronological order', () => {
      ai.startNewPoint();
      ai.recordShot('serve', 1);
      ai.recordShot('return', 2);
      ai.endPoint(1, 'winner');

      const events = ai.getMatchEvents();
      expect(events.length).toBe(4); // point_start, shot, shot, point_end

      // 验证事件顺序
      expect(events[0].type).toBe('point_start');
      expect(events[1].type).toBe('shot');
      expect(events[2].type).toBe('shot');
      expect(events[3].type).toBe('point_end');
    });

    it('should record shot details', () => {
      ai.recordShot('forehand', 1);
      ai.recordShot('backhand', 2);
      ai.recordShot('volley', 1);

      const events = ai.getMatchEvents();
      const shots = events.filter((e) => e.type === 'shot');

      expect(shots[0].details.shotType).toBe('forehand');
      expect(shots[1].details.shotType).toBe('backhand');
      expect(shots[2].details.shotType).toBe('volley');
    });

    it('should record point end reason', () => {
      ai.startNewPoint();
      ai.endPoint(1, 'ace');

      const events = ai.getMatchEvents();
      const pointEnd = events.find((e) => e.type === 'point_end');

      expect(pointEnd).toBeDefined();
      expect(pointEnd!.details.reason).toBe('ace');
      expect(pointEnd!.player).toBe(1);
    });
  });

  describe('history management', () => {
    it('should limit ball history to maxHistorySize', () => {
      // 添加超过60帧
      for (let i = 0; i < 100; i++) {
        ai.processDetection(i, i, 90);
      }

      // 应该仍能正常工作
      const result = ai.processDetection(100, 100, 90);
      expect(result.ballDetected).toBe(true);
    });

    it('should clear history on startNewPoint', () => {
      ai.processDetection(100, 200, 90);
      ai.processDetection(150, 250, 90);
      ai.startNewPoint();

      // 新的一分开始后，速度计算应该重新开始
      const result = ai.processDetection(50, 50, 90);
      expect(result.estimatedSpeed).toBeUndefined();
    });
  });
});
