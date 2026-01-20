/**
 * HawkEyeCamera 组件
 *
 * 使用 react-native-vision-camera 实现高性能摄像头捕捉
 * 支持 Frame Processors 进行实时网球检测
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useFrameProcessor,
  Frame,
} from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { visionHawkEye, BallDetection, HawkEyeAnalysis } from '../services/visionHawkEye';
import {
  detectTennisBall,
  isNativeDetectionAvailable,
  NativeDetectionResult,
} from '../services/nativeBallDetector';
import { CalibrationPoint } from '../stores/matchStore';

interface HawkEyeCameraProps {
  // 是否启用检测
  isDetecting: boolean;
  // 校准点
  calibrationPoints?: CalibrationPoint[];
  // 检测回调
  onDetection?: (analysis: HawkEyeAnalysis) => void;
  // 落地回调
  onBounce?: (isIn: boolean, distance: number) => void;
  // FPS 更新回调
  onFpsUpdate?: (fps: number) => void;
  // 是否显示调试信息
  showDebug?: boolean;
  // 目标 FPS
  targetFps?: number;
  // 分辨率
  resolution?: '720p' | '1080p' | '4k';
  // 自定义样式
  style?: object;
  // 是否使用原生 ML 检测 (需要 Development Build)
  useNativeDetection?: boolean;
}

// 模拟检测（在没有真实检测时使用）
// 后续会被 Native Frame Processor 替换
const simulateDetection = (
  width: number,
  height: number,
  timestamp: number
): BallDetection | null => {
  // 模拟一个移动的球
  const t = timestamp / 1000;
  const x = width / 2 + Math.sin(t * 2) * width * 0.3;
  const y = height / 2 + Math.cos(t * 1.5) * height * 0.2;

  // 随机决定是否检测到球
  if (Math.random() > 0.1) {
    return {
      x,
      y,
      confidence: 0.8 + Math.random() * 0.2,
      timestamp,
      frameWidth: width,
      frameHeight: height,
    };
  }
  return null;
};

export default function HawkEyeCamera({
  isDetecting,
  calibrationPoints,
  onDetection,
  onBounce,
  onFpsUpdate,
  showDebug = false,
  targetFps = 60,
  resolution = '1080p',
  style,
  useNativeDetection = true,
}: HawkEyeCameraProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [fps, setFps] = useState(0);
  const [lastAnalysis, setLastAnalysis] = useState<HawkEyeAnalysis | null>(null);
  const [detectionMode, setDetectionMode] = useState<'native' | 'simulation'>('simulation');
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());

  // Check native detection availability on mount
  useEffect(() => {
    const nativeAvailable = isNativeDetectionAvailable();
    setDetectionMode(useNativeDetection && nativeAvailable ? 'native' : 'simulation');
    if (showDebug) {
      console.log(`[HawkEyeCamera] Detection mode: ${nativeAvailable ? 'native' : 'simulation'}`);
    }
  }, [useNativeDetection, showDebug]);

  // 获取后置摄像头
  const device = useCameraDevice('back');

  // 配置摄像头格式
  const format = useCameraFormat(device, [
    {
      videoResolution:
        resolution === '4k'
          ? { width: 3840, height: 2160 }
          : resolution === '1080p'
            ? { width: 1920, height: 1080 }
            : { width: 1280, height: 720 },
    },
    { fps: targetFps },
  ]);

  // 请求摄像头权限
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // 设置校准点
  useEffect(() => {
    if (calibrationPoints && calibrationPoints.length === 4) {
      visionHawkEye.setCalibration(calibrationPoints);
    }
  }, [calibrationPoints]);

  // 处理检测结果 (在 JS 线程运行)
  const handleDetection = useCallback(
    (detection: BallDetection | null) => {
      if (!detection) return;

      const analysis = visionHawkEye.processDetection(detection);
      setLastAnalysis(analysis);

      if (onDetection) {
        onDetection(analysis);
      }

      // 检查是否有新的落地事件
      const lastBounce = analysis.bounceEvents[analysis.bounceEvents.length - 1];
      if (lastBounce && onBounce) {
        onBounce(lastBounce.isInBounds, lastBounce.distanceFromLine);
      }
    },
    [onDetection, onBounce]
  );

  // 使用 runOnJS 桥接 Worklet 和 JS 线程
  const runHandleDetection = useRunOnJS(handleDetection, [handleDetection]);

  // Frame Processor - 在每一帧上运行
  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';

      if (!isDetecting) return;

      // 更新帧计数
      frameCountRef.current++;

      // 获取帧信息
      const width = frame.width;
      const height = frame.height;
      const timestamp = Date.now();

      // 每 2 帧检测一次以提高性能
      if (frameCountRef.current % 2 !== 0) return;

      // 尝试使用原生 ML 检测
      const nativeResult = detectTennisBall(frame, { confidence: 0.5 });

      if (nativeResult) {
        // 原生检测成功，转换为 BallDetection 格式
        const detection: BallDetection = {
          x: nativeResult.x,
          y: nativeResult.y,
          confidence: nativeResult.confidence,
          timestamp: nativeResult.timestamp,
          frameWidth: nativeResult.frameWidth,
          frameHeight: nativeResult.frameHeight,
        };
        runHandleDetection(detection);
      } else {
        // 原生检测不可用或未检测到，使用模拟检测
        const detection = simulateDetection(width, height, timestamp);
        if (detection) {
          runHandleDetection(detection);
        }
      }
    },
    [isDetecting, runHandleDetection]
  );

  // FPS 计算
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFpsUpdateRef.current) / 1000;
      const currentFps = Math.round(frameCountRef.current / elapsed);

      setFps(currentFps);
      if (onFpsUpdate) {
        onFpsUpdate(currentFps);
      }

      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [onFpsUpdate]);

  // 没有权限时显示提示
  if (!hasPermission) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>需要摄像头权限</Text>
      </View>
    );
  }

  // 没有摄像头设备时显示提示
  if (!device) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>未找到摄像头设备</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={true}
        frameProcessor={frameProcessor}
        fps={targetFps}
        pixelFormat="yuv"
        enableZoomGesture
      />

      {/* 调试信息叠加层 */}
      {showDebug && (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugText}>FPS: {fps}</Text>
          <Text style={styles.debugText}>
            模式: {detectionMode === 'native' ? 'ML原生' : '模拟'}
          </Text>
          <Text style={styles.debugText}>检测: {isDetecting ? '开启' : '关闭'}</Text>
          <Text style={styles.debugText}>
            校准: {visionHawkEye.isCalibrated() ? '已完成' : '未完成'}
          </Text>
          {lastAnalysis && (
            <>
              <Text style={styles.debugText}>球速: {lastAnalysis.ballSpeed.toFixed(1)} km/h</Text>
              <Text style={styles.debugText}>轨迹点: {lastAnalysis.trajectory.length}</Text>
              <Text style={styles.debugText}>落地次数: {lastAnalysis.bounceEvents.length}</Text>
            </>
          )}
        </View>
      )}

      {/* 轨迹绘制层 */}
      {showDebug && lastAnalysis && lastAnalysis.trajectory.length > 0 && (
        <View style={styles.trajectoryOverlay} pointerEvents="none">
          {lastAnalysis.trajectory.slice(-20).map((point, index) => (
            <View
              key={index}
              style={[
                styles.trajectoryPoint,
                {
                  left: point.screenX - 4,
                  top: point.screenY - 4,
                  opacity: (index + 1) / 20,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  debugOverlay: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  trajectoryOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  trajectoryPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
});
