/**
 * 鹰眼测试页面
 *
 * 用于测试 VisionCamera + AI 检测功能
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import HawkEyeCamera from '../../src/components/HawkEyeCamera';
import { HawkEyeAnalysis, BounceEvent } from '../../src/services/visionHawkEye';

export default function HawkEyeTestPage() {
  const router = useRouter();
  const [isDetecting, setIsDetecting] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [fps, setFps] = useState(0);
  const [lastBounce, setLastBounce] = useState<BounceEvent | null>(null);
  const [bounceCount, setBounceCount] = useState(0);

  // 模拟校准点 (实际应该从校准页面获取)
  const calibrationPoints = [
    { x: 100, y: 200, label: 'TL' as const },
    { x: 300, y: 200, label: 'TR' as const },
    { x: 350, y: 500, label: 'BR' as const },
    { x: 50, y: 500, label: 'BL' as const },
  ];

  const handleDetection = useCallback((analysis: HawkEyeAnalysis) => {
    // 处理检测结果
    // console.log('Detection:', analysis.trajectory.length, 'points');
  }, []);

  const handleBounce = useCallback((isIn: boolean, distance: number) => {
    setBounceCount((prev) => prev + 1);
    setLastBounce({
      screenPosition: { x: 0, y: 0 },
      courtPosition: { x: 0, y: 0 },
      timestamp: Date.now(),
      isInBounds: isIn,
      confidence: 0.9,
      distanceFromLine: distance,
    });

    // 显示判定结果
    if (Platform.OS !== 'web') {
      Alert.alert(
        isIn ? '✅ IN' : '❌ OUT',
        `距离边线: ${(distance / 10).toFixed(1)} cm`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    }
  }, []);

  const handleFpsUpdate = useCallback((newFps: number) => {
    setFps(newFps);
  }, []);

  const toggleDetection = () => {
    setIsDetecting((prev) => !prev);
  };

  const toggleDebug = () => {
    setShowDebug((prev) => !prev);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 相机视图 */}
      <View style={styles.cameraContainer}>
        <HawkEyeCamera
          isDetecting={isDetecting}
          calibrationPoints={calibrationPoints}
          onDetection={handleDetection}
          onBounce={handleBounce}
          onFpsUpdate={handleFpsUpdate}
          showDebug={showDebug}
          targetFps={60}
          resolution="1080p"
        />
      </View>

      {/* 状态栏 */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>FPS</Text>
          <Text style={styles.statusValue}>{fps}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>落地</Text>
          <Text style={styles.statusValue}>{bounceCount}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>状态</Text>
          <Text style={[styles.statusValue, isDetecting ? styles.active : styles.inactive]}>
            {isDetecting ? '检测中' : '暂停'}
          </Text>
        </View>
      </View>

      {/* 最后落地判定 */}
      {lastBounce && (
        <View
          style={[
            styles.bounceResult,
            lastBounce.isInBounds ? styles.bounceIn : styles.bounceOut,
          ]}
        >
          <Text style={styles.bounceText}>
            {lastBounce.isInBounds ? '✅ IN' : '❌ OUT'}
          </Text>
          <Text style={styles.bounceDistance}>
            距边线: {(lastBounce.distanceFromLine / 10).toFixed(1)} cm
          </Text>
        </View>
      )}

      {/* 控制按钮 */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isDetecting ? styles.buttonStop : styles.buttonStart]}
          onPress={toggleDetection}
        >
          <Text style={styles.buttonText}>
            {isDetecting ? '停止检测' : '开始检测'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={toggleDebug}
        >
          <Text style={styles.buttonTextSecondary}>
            {showDebug ? '隐藏调试' : '显示调试'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonTextSecondary}>返回</Text>
        </TouchableOpacity>
      </View>

      {/* 说明 */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>🎾 鹰眼测试模式</Text>
        <Text style={styles.infoText}>
          当前使用模拟数据进行演示。{'\n'}
          实际使用时需要:{'\n'}
          1. 训练 YOLOv8 模型{'\n'}
          2. 集成 CoreML 推理{'\n'}
          3. 完成球场校准
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 10,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    color: '#888',
    fontSize: 12,
  },
  statusValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  active: {
    color: '#10B981',
  },
  inactive: {
    color: '#888',
  },
  bounceResult: {
    margin: 10,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  bounceIn: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  bounceOut: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  bounceText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bounceDistance: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#10B981',
  },
  buttonStop: {
    backgroundColor: '#EF4444',
  },
  buttonSecondary: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: '#ccc',
    fontSize: 14,
  },
  infoBox: {
    margin: 10,
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
});
