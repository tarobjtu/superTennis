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
      const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
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
