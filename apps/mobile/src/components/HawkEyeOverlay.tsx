/**
 * 鹰眼判定结果覆盖层组件
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BallLandingResult } from '../services/hawkEye';

interface HawkEyeOverlayProps {
  result: BallLandingResult | null;
  visible: boolean;
  onAnimationComplete?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COURT_WIDTH = SCREEN_WIDTH - 40;
const COURT_HEIGHT = COURT_WIDTH * 2.17; // 按比例

export default function HawkEyeOverlay({
  result,
  visible,
  onAnimationComplete,
}: HawkEyeOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const ballAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && result) {
      // 重置动画
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      ballAnim.setValue(0);

      // 执行动画序列
      Animated.sequence([
        // 1. 淡入背景
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // 2. 球落点动画
        Animated.timing(ballAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // 3. 保持显示
        Animated.delay(2000),
        // 4. 淡出
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete?.();
      });
    }
  }, [visible, result]);

  if (!visible || !result) {
    return null;
  }

  const isIn = result.isIn;
  const confidence = Math.round(result.confidence);
  const distance = Math.abs(result.distanceFromLine);

  // 计算球在屏幕上的位置（标准化到球场范围）
  const courtCenterX = COURT_WIDTH / 2;
  const courtCenterY = COURT_HEIGHT / 2;
  const scaleFactorX = COURT_WIDTH / 10.97; // 双打宽度
  const scaleFactorY = COURT_HEIGHT / 23.77; // 球场长度

  const ballScreenX = courtCenterX + result.landingPoint.x * scaleFactorX;
  const ballScreenY = courtCenterY + result.landingPoint.y * scaleFactorY;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* 球场示意图 */}
      <View style={styles.courtContainer}>
        <View style={styles.court}>
          {/* 边线 */}
          <View style={styles.courtLines}>
            {/* 底线 */}
            <View style={[styles.line, styles.baselineTop]} />
            <View style={[styles.line, styles.baselineBottom]} />
            {/* 边线 */}
            <View style={[styles.line, styles.sidelineLeft]} />
            <View style={[styles.line, styles.sidelineRight]} />
            {/* 发球线 */}
            <View style={[styles.line, styles.serviceLineTop]} />
            <View style={[styles.line, styles.serviceLineBottom]} />
            {/* 中线 */}
            <View style={[styles.line, styles.centerLine]} />
            {/* 网 */}
            <View style={styles.net} />
          </View>

          {/* 球落点 */}
          <Animated.View
            style={[
              styles.ballMarker,
              {
                left: ballScreenX - 15,
                top: ballScreenY - 15,
                backgroundColor: isIn ? '#10B981' : '#EF4444',
                opacity: ballAnim,
                transform: [
                  {
                    scale: ballAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.3, 1.2, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.ballInner} />
          </Animated.View>

          {/* 距离指示线 */}
          {result.lineType && (
            <Animated.View
              style={[
                styles.distanceLine,
                {
                  opacity: ballAnim,
                  left: ballScreenX,
                  top: ballScreenY,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* 判定结果 */}
      <View style={[styles.resultContainer, isIn ? styles.resultIn : styles.resultOut]}>
        <Text style={styles.resultText}>{isIn ? 'IN' : 'OUT'}</Text>
        <Text style={styles.confidenceText}>置信度: {confidence}%</Text>
        <Text style={styles.distanceText}>
          距边线: {distance.toFixed(0)}mm {isIn ? '界内' : '出界'}
        </Text>
      </View>

      {/* 线类型 */}
      <View style={styles.lineTypeContainer}>
        <Text style={styles.lineTypeText}>
          {result.lineType === 'baseline' && '底线'}
          {result.lineType === 'sideline' && '边线'}
          {result.lineType === 'service' && '发球线'}
          {result.lineType === 'center' && '中线'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  courtContainer: {
    width: COURT_WIDTH,
    height: COURT_HEIGHT,
    maxHeight: 400,
    marginBottom: 30,
  },
  court: {
    flex: 1,
    backgroundColor: '#1E40AF',
    borderRadius: 4,
    position: 'relative',
  },
  courtLines: {
    ...StyleSheet.absoluteFillObject,
  },
  line: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  baselineTop: {
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  baselineBottom: {
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  sidelineLeft: {
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  sidelineRight: {
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
  },
  serviceLineTop: {
    top: '27%',
    left: '12%',
    right: '12%',
    height: 2,
  },
  serviceLineBottom: {
    bottom: '27%',
    left: '12%',
    right: '12%',
    height: 2,
  },
  centerLine: {
    left: '50%',
    top: '27%',
    bottom: '27%',
    width: 2,
    marginLeft: -1,
  },
  net: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#fff',
    marginTop: -1.5,
  },
  ballMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  ballInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  distanceLine: {
    position: 'absolute',
    width: 2,
    height: 30,
    backgroundColor: '#FBBF24',
  },
  resultContainer: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  resultIn: {
    backgroundColor: '#10B981',
  },
  resultOut: {
    backgroundColor: '#EF4444',
  },
  resultText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  confidenceText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
  },
  distanceText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  lineTypeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  lineTypeText: {
    color: '#fff',
    fontSize: 14,
  },
});
