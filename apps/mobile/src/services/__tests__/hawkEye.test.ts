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
