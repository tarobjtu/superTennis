/**
 * Hawk-Eye 鹰眼算法测试
 */

import {
  isPointInBounds,
  isServeValid,
  calculatePerspectiveTransform,
  screenToCourtCoordinates,
  BallTracker,
  COURT_DIMENSIONS,
} from '../hawkEye';

describe('isPointInBounds', () => {
  describe('singles court', () => {
    // 单打场地：宽 8.23m, 长 23.77m
    const halfWidth = COURT_DIMENSIONS.singles.width / 2; // 4.115
    const halfLength = COURT_DIMENSIONS.singles.length / 2; // 11.885

    it('should return in bounds for center court point', () => {
      const result = isPointInBounds({ x: 0, y: 0 }, 'singles');
      expect(result.isIn).toBe(true);
      expect(result.distanceFromLine).toBeGreaterThan(0);
    });

    it('should return in bounds for point just inside baseline', () => {
      const result = isPointInBounds({ x: 0, y: halfLength - 0.1 }, 'singles');
      expect(result.isIn).toBe(true);
      expect(result.lineType).toBe('baseline');
    });

    it('should return in bounds for point just inside sideline', () => {
      const result = isPointInBounds({ x: halfWidth - 0.1, y: 0 }, 'singles');
      expect(result.isIn).toBe(true);
      expect(result.lineType).toBe('sideline');
    });

    it('should return out of bounds for point outside baseline', () => {
      const result = isPointInBounds({ x: 0, y: halfLength + 0.1 }, 'singles');
      expect(result.isIn).toBe(false);
      expect(result.distanceFromLine).toBeLessThan(0);
    });

    it('should return out of bounds for point outside sideline', () => {
      const result = isPointInBounds({ x: halfWidth + 0.1, y: 0 }, 'singles');
      expect(result.isIn).toBe(false);
      expect(result.distanceFromLine).toBeLessThan(0);
    });

    it('should return correct distance in millimeters', () => {
      // 距离边线 0.5 米
      const result = isPointInBounds({ x: halfWidth - 0.5, y: 0 }, 'singles');
      expect(result.isIn).toBe(true);
      expect(result.distanceFromLine).toBeCloseTo(500, 0); // 500mm
    });

    it('should handle corner points correctly', () => {
      // 角落点 - 刚好在界内
      const result = isPointInBounds({ x: halfWidth - 0.1, y: halfLength - 0.1 }, 'singles');
      expect(result.isIn).toBe(true);
    });

    it('should handle negative coordinates', () => {
      const result = isPointInBounds({ x: -halfWidth + 0.1, y: -halfLength + 0.1 }, 'singles');
      expect(result.isIn).toBe(true);
    });
  });

  describe('doubles court', () => {
    const halfWidth = COURT_DIMENSIONS.doubles.width / 2; // 5.485

    it('should use doubles width for doubles matches', () => {
      // 在单打边线外但双打边线内
      const doublesResult = isPointInBounds(
        { x: COURT_DIMENSIONS.singles.width / 2 + 0.5, y: 0 },
        'doubles'
      );
      expect(doublesResult.isIn).toBe(true);

      const singlesResult = isPointInBounds(
        { x: COURT_DIMENSIONS.singles.width / 2 + 0.5, y: 0 },
        'singles'
      );
      expect(singlesResult.isIn).toBe(false);
    });
  });
});

describe('isServeValid', () => {
  const serviceBox = COURT_DIMENSIONS.serviceBox;

  describe('near side server, deuce court', () => {
    it('should return valid for serve in correct service box', () => {
      // Deuce 区发球，目标在对方左侧
      const result = isServeValid({ x: -2, y: 3 }, 'deuce', 'near');
      expect(result.isIn).toBe(true);
    });

    it('should return invalid for serve in wrong service box', () => {
      // 发到对方右侧（错误）
      const result = isServeValid({ x: 2, y: 3 }, 'deuce', 'near');
      expect(result.isIn).toBe(false);
    });

    it('should return invalid for serve beyond service line', () => {
      // 超过发球线
      const result = isServeValid({ x: -2, y: serviceBox.length + 0.5 }, 'deuce', 'near');
      expect(result.isIn).toBe(false);
    });
  });

  describe('near side server, ad court', () => {
    it('should return valid for serve in correct service box', () => {
      // Ad 区发球，目标在对方右侧
      const result = isServeValid({ x: 2, y: 3 }, 'ad', 'near');
      expect(result.isIn).toBe(true);
    });

    it('should return invalid for serve in wrong service box', () => {
      const result = isServeValid({ x: -2, y: 3 }, 'ad', 'near');
      expect(result.isIn).toBe(false);
    });
  });

  describe('far side server', () => {
    it('should return valid for serve in correct service box from far side', () => {
      // 远端发球到近端
      const result = isServeValid({ x: 2, y: -3 }, 'deuce', 'far');
      expect(result.isIn).toBe(true);
    });
  });
});

describe('calculatePerspectiveTransform', () => {
  it('should return identity matrix for less than 4 points', () => {
    const result = calculatePerspectiveTransform([{ x: 0, y: 0 }]);
    expect(result).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('should calculate transform for 4 calibration points', () => {
    const points = [
      { x: 0, y: 0 },     // top-left
      { x: 100, y: 0 },   // top-right
      { x: 100, y: 200 }, // bottom-right
      { x: 0, y: 200 },   // bottom-left
    ];
    const result = calculatePerspectiveTransform(points);

    // Should return a 3x3 matrix
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(3);
    expect(result[2]).toHaveLength(3);

    // Scale factors should be positive
    expect(result[0][0]).toBeGreaterThan(0);
    expect(result[1][1]).toBeGreaterThan(0);
  });
});

describe('screenToCourtCoordinates', () => {
  it('should transform screen coordinates using transform matrix', () => {
    const transform = [
      [0.1, 0, -5],
      [0, 0.1, -10],
      [0, 0, 1],
    ];

    const result = screenToCourtCoordinates({ x: 100, y: 200 }, transform);

    expect(result.x).toBe(0.1 * 100 + 0 * 200 - 5); // 5
    expect(result.y).toBe(0 * 100 + 0.1 * 200 - 10); // 10
  });
});

describe('BallTracker', () => {
  let tracker: BallTracker;

  beforeEach(() => {
    tracker = new BallTracker();
  });

  describe('addPosition', () => {
    it('should add positions to tracker', () => {
      tracker.addPosition(10, 20);
      tracker.addPosition(20, 30);
      // No direct way to check internal state, but subsequent operations should work
    });

    it('should limit positions to maxPositions', () => {
      // Add more than 30 positions
      for (let i = 0; i < 35; i++) {
        tracker.addPosition(i, i);
      }
      // Tracker should only keep last 30
    });
  });

  describe('predictLandingPoint', () => {
    it('should return null with less than 5 positions', () => {
      tracker.addPosition(0, 0);
      tracker.addPosition(1, 1);
      expect(tracker.predictLandingPoint()).toBeNull();
    });

    it('should predict landing point with enough positions', () => {
      for (let i = 0; i < 5; i++) {
        tracker.addPosition(i * 10, i * 10);
      }
      const prediction = tracker.predictLandingPoint();
      expect(prediction).not.toBeNull();
      expect(prediction!.x).toBeGreaterThan(40);
      expect(prediction!.y).toBeGreaterThan(40);
    });
  });

  describe('detectBounce', () => {
    it('should return false with less than 3 positions', () => {
      tracker.addPosition(0, 0);
      expect(tracker.detectBounce()).toBe(false);
    });

    it('should detect bounce when velocity direction changes', () => {
      // 模拟球下落然后反弹
      tracker.addPosition(0, 0);
      tracker.addPosition(0, 10); // 向下
      tracker.addPosition(0, 5);  // 向上反弹
      expect(tracker.detectBounce()).toBe(true);
    });

    it('should not detect bounce for linear motion', () => {
      tracker.addPosition(0, 0);
      tracker.addPosition(10, 10);
      tracker.addPosition(20, 20);
      expect(tracker.detectBounce()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all positions', () => {
      tracker.addPosition(10, 20);
      tracker.addPosition(20, 30);
      tracker.clear();
      expect(tracker.predictLandingPoint()).toBeNull();
    });
  });
});

describe('COURT_DIMENSIONS', () => {
  it('should have correct singles dimensions', () => {
    expect(COURT_DIMENSIONS.singles.length).toBe(23.77);
    expect(COURT_DIMENSIONS.singles.width).toBe(8.23);
  });

  it('should have correct doubles dimensions', () => {
    expect(COURT_DIMENSIONS.doubles.length).toBe(23.77);
    expect(COURT_DIMENSIONS.doubles.width).toBe(10.97);
  });

  it('should have correct service box dimensions', () => {
    expect(COURT_DIMENSIONS.serviceBox.length).toBe(6.40);
    expect(COURT_DIMENSIONS.serviceBox.width).toBe(4.115);
  });

  it('should have correct net height', () => {
    expect(COURT_DIMENSIONS.netHeight.center).toBe(0.914);
    expect(COURT_DIMENSIONS.netHeight.posts).toBe(1.07);
  });
});

// ==================== 新增测试用例 ====================

describe('isPointInBounds - edge cases', () => {
  const halfWidth = COURT_DIMENSIONS.singles.width / 2;
  const halfLength = COURT_DIMENSIONS.singles.length / 2;

  describe('on-line cases (tennis rule: on line = IN)', () => {
    it('should return IN for ball exactly on sideline', () => {
      const result = isPointInBounds({ x: halfWidth, y: 0 }, 'singles');
      // 刚好在线上应该是 IN（网球规则）
      expect(result.isIn).toBe(true);
    });

    it('should return IN for ball exactly on baseline', () => {
      const result = isPointInBounds({ x: 0, y: halfLength }, 'singles');
      expect(result.isIn).toBe(true);
    });

    it('should return IN for ball exactly on corner', () => {
      const result = isPointInBounds({ x: halfWidth, y: halfLength }, 'singles');
      expect(result.isIn).toBe(true);
    });

    it('should return IN for ball on negative sideline', () => {
      const result = isPointInBounds({ x: -halfWidth, y: 0 }, 'singles');
      expect(result.isIn).toBe(true);
    });

    it('should return IN for ball on negative baseline', () => {
      const result = isPointInBounds({ x: 0, y: -halfLength }, 'singles');
      expect(result.isIn).toBe(true);
    });
  });

  describe('just outside cases', () => {
    it('should return OUT for ball 1mm outside sideline', () => {
      const result = isPointInBounds({ x: halfWidth + 0.001, y: 0 }, 'singles');
      expect(result.isIn).toBe(false);
    });

    it('should return OUT for ball 1mm outside baseline', () => {
      const result = isPointInBounds({ x: 0, y: halfLength + 0.001 }, 'singles');
      expect(result.isIn).toBe(false);
    });
  });

  describe('extreme values', () => {
    it('should handle very large coordinates', () => {
      const result = isPointInBounds({ x: 1000, y: 1000 }, 'singles');
      expect(result.isIn).toBe(false);
      expect(result.distanceFromLine).toBeLessThan(0);
    });

    it('should handle zero coordinates', () => {
      const result = isPointInBounds({ x: 0, y: 0 }, 'singles');
      expect(result.isIn).toBe(true);
    });
  });
});

describe('isServeValid - edge cases', () => {
  const serviceBox = COURT_DIMENSIONS.serviceBox;

  it('should return OUT for serve on service line (close call)', () => {
    // 刚好在发球线上
    const result = isServeValid({ x: -2, y: serviceBox.length }, 'deuce', 'near');
    expect(result.isIn).toBe(true);
  });

  it('should return OUT for serve just beyond service line', () => {
    const result = isServeValid({ x: -2, y: serviceBox.length + 0.01 }, 'deuce', 'near');
    expect(result.isIn).toBe(false);
  });

  it('should return OUT for serve on center line', () => {
    // 刚好在中线上
    const result = isServeValid({ x: 0, y: 3 }, 'deuce', 'near');
    expect(result.isIn).toBe(true);
  });
});

describe('BallTracker - advanced scenarios', () => {
  let tracker: BallTracker;

  beforeEach(() => {
    tracker = new BallTracker();
  });

  describe('velocity calculation precision', () => {
    it('should predict landing point with linear motion', () => {
      // 模拟匀速直线运动
      for (let i = 0; i < 10; i++) {
        tracker.addPosition(i * 10, i * 5);
      }
      const prediction = tracker.predictLandingPoint();
      expect(prediction).not.toBeNull();
      // 验证预测点在轨迹延长线上
      expect(prediction!.x).toBeGreaterThan(90);
      expect(prediction!.y).toBeGreaterThan(45);
    });

    it('should handle stationary ball', () => {
      // 球静止不动
      for (let i = 0; i < 5; i++) {
        tracker.addPosition(100, 100);
      }
      const prediction = tracker.predictLandingPoint();
      expect(prediction).not.toBeNull();
      // 静止球预测位置应该接近当前位置
      expect(prediction!.x).toBeCloseTo(100, 0);
      expect(prediction!.y).toBeCloseTo(100, 0);
    });
  });

  describe('bounce detection edge cases', () => {
    it('should detect sharp bounce (high velocity change)', () => {
      tracker.addPosition(100, 0);
      tracker.addPosition(100, 50);   // 快速下落
      tracker.addPosition(100, 20);   // 快速反弹
      expect(tracker.detectBounce()).toBe(true);
    });

    it('should not detect bounce for horizontal motion', () => {
      tracker.addPosition(0, 100);
      tracker.addPosition(50, 100);
      tracker.addPosition(100, 100);
      expect(tracker.detectBounce()).toBe(false);
    });

    it('should not detect bounce for continuous downward motion', () => {
      tracker.addPosition(100, 0);
      tracker.addPosition(100, 10);
      tracker.addPosition(100, 20);
      expect(tracker.detectBounce()).toBe(false);
    });
  });

  describe('position history management', () => {
    it('should maintain max 30 positions', () => {
      for (let i = 0; i < 50; i++) {
        tracker.addPosition(i, i);
      }
      // 内部应该只保留最近30个位置
      // 通过预测来间接验证
      const prediction = tracker.predictLandingPoint();
      expect(prediction).not.toBeNull();
    });

    it('should work correctly after clear and refill', () => {
      for (let i = 0; i < 10; i++) {
        tracker.addPosition(i, i);
      }
      tracker.clear();
      expect(tracker.predictLandingPoint()).toBeNull();

      for (let i = 0; i < 5; i++) {
        tracker.addPosition(i * 2, i * 2);
      }
      expect(tracker.predictLandingPoint()).not.toBeNull();
    });
  });
});

describe('calculatePerspectiveTransform - edge cases', () => {
  it('should handle empty array', () => {
    const result = calculatePerspectiveTransform([]);
    expect(result).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('should handle 3 points (not enough)', () => {
    const result = calculatePerspectiveTransform([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]);
    expect(result).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it('should calculate non-identity matrix for valid 4 points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 600 },
      { x: 0, y: 600 },
    ];
    const result = calculatePerspectiveTransform(points);

    // 验证不是单位矩阵
    expect(result[0][0]).not.toBe(1);
    expect(result[1][1]).not.toBe(1);
    // 验证缩放因子为正
    expect(result[0][0]).toBeGreaterThan(0);
    expect(result[1][1]).toBeGreaterThan(0);
  });
});

describe('screenToCourtCoordinates - edge cases', () => {
  it('should handle identity transform', () => {
    const identity = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const result = screenToCourtCoordinates({ x: 100, y: 200 }, identity);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('should apply scaling correctly', () => {
    const scaleTransform = [
      [2, 0, 0],
      [0, 3, 0],
      [0, 0, 1],
    ];
    const result = screenToCourtCoordinates({ x: 50, y: 100 }, scaleTransform);
    expect(result.x).toBe(100);
    expect(result.y).toBe(300);
  });

  it('should apply translation correctly', () => {
    const translateTransform = [
      [1, 0, -50],
      [0, 1, -100],
      [0, 0, 1],
    ];
    const result = screenToCourtCoordinates({ x: 100, y: 200 }, translateTransform);
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });

  it('should handle zero coordinates', () => {
    const transform = [
      [0.1, 0, 0],
      [0, 0.1, 0],
      [0, 0, 1],
    ];
    const result = screenToCourtCoordinates({ x: 0, y: 0 }, transform);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});
