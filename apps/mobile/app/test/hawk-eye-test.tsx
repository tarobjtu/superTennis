/**
 * 鹰眼测试页面
 * 用于在真实手机上测试摄像头和球追踪效果
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { router, Stack } from 'expo-router';
import { RealTimeBallTracker, DetectedBall, TENNIS_BALL_COLOR } from '../../src/services/ballDetection';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type TestMode = 'preview' | 'tracking' | 'calibration' | 'results';

interface TestStats {
  framesProcessed: number;
  ballsDetected: number;
  avgFPS: number;
  avgProcessingTime: number;
  bounceDetections: number;
}

export default function HawkEyeTestScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [testMode, setTestMode] = useState<TestMode>('preview');
  const [isRecording, setIsRecording] = useState(false);
  const [stats, setStats] = useState<TestStats>({
    framesProcessed: 0,
    ballsDetected: 0,
    avgFPS: 0,
    avgProcessingTime: 0,
    bounceDetections: 0,
  });
  const [detectedBalls, setDetectedBalls] = useState<DetectedBall[]>([]);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const trackerRef = useRef(new RealTimeBallTracker());
  const frameCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  // 添加调试日志
  const addLog = useCallback((message: string) => {
    setDebugInfo(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${message}`];
      return newLogs.slice(-20); // 保留最近20条
    });
  }, []);

  // 处理摄像头权限
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // 切换摄像头
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
    addLog(`切换到${facing === 'back' ? '前置' : '后置'}摄像头`);
  };

  // 开始测试
  const startTracking = () => {
    setTestMode('tracking');
    setIsRecording(true);
    trackerRef.current.reset();
    setStats({
      framesProcessed: 0,
      ballsDetected: 0,
      avgFPS: 0,
      avgProcessingTime: 0,
      bounceDetections: 0,
    });
    addLog('开始球追踪测试');
  };

  // 停止测试
  const stopTracking = () => {
    setIsRecording(false);
    setTestMode('results');

    const debugInfo = trackerRef.current.getDebugInfo();
    setStats(prev => ({
      ...prev,
      avgFPS: debugInfo.fps,
      avgProcessingTime: debugInfo.avgProcessingTime,
    }));
    addLog(`测试结束: ${stats.framesProcessed} 帧, ${stats.ballsDetected} 次检测`);
  };

  // 模拟帧处理（实际应使用 native 模块）
  const simulateFrameProcessing = useCallback(() => {
    if (!isRecording) return;

    frameCountRef.current++;
    const now = Date.now();

    // 模拟检测结果
    // 实际应用中，这里需要接入真实的帧数据
    const mockDetection: DetectedBall | null = Math.random() > 0.7 ? {
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT * 0.6,
      radius: 15 + Math.random() * 10,
      confidence: 60 + Math.random() * 35,
      timestamp: now,
    } : null;

    if (mockDetection) {
      setDetectedBalls(prev => [...prev.slice(-10), mockDetection]);
      setStats(prev => ({
        ...prev,
        ballsDetected: prev.ballsDetected + 1,
      }));
    }

    // 更新统计
    if (now - lastUpdateRef.current >= 1000) {
      const fps = frameCountRef.current;
      frameCountRef.current = 0;
      lastUpdateRef.current = now;

      setStats(prev => ({
        ...prev,
        framesProcessed: prev.framesProcessed + fps,
        avgFPS: fps,
      }));
    }
  }, [isRecording]);

  // 定期处理帧
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(simulateFrameProcessing, 33); // ~30 FPS
    return () => clearInterval(interval);
  }, [isRecording, simulateFrameProcessing]);

  // 运行手动测试
  const runManualTest = () => {
    addLog('运行手动球检测测试...');

    // 测试颜色检测
    const testColors = [
      { r: 200, g: 200, b: 50, expected: true, name: '网球黄' },
      { r: 180, g: 230, b: 80, expected: true, name: '浅绿黄' },
      { r: 255, g: 0, b: 0, expected: false, name: '红色' },
      { r: 50, g: 50, b: 200, expected: false, name: '蓝色' },
      { r: 255, g: 255, b: 255, expected: false, name: '白色' },
    ];

    let passed = 0;
    for (const color of testColors) {
      const { rgbToHsv, isTennisBallColor } = require('../../src/services/ballDetection');
      const hsv = rgbToHsv(color.r, color.g, color.b);
      const isBall = isTennisBallColor(color.r, color.g, color.b);
      const result = isBall === color.expected;

      addLog(`${color.name}: HSV(${hsv.h},${hsv.s},${hsv.v}) => ${isBall ? 'YES' : 'NO'} ${result ? '✓' : '✗'}`);
      if (result) passed++;
    }

    Alert.alert('测试完成', `通过 ${passed}/${testColors.length} 项颜色检测测试`);
  };

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: '鹰眼测试' }} />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>需要摄像头权限来测试鹰眼功能</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>授权摄像头</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '鹰眼测试',
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
        }}
      />
      <View style={styles.container}>
        {/* 摄像头预览 */}
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing={facing}
          />

          {/* 检测到的球的可视化 */}
          {testMode === 'tracking' && detectedBalls.map((ball, index) => (
            <View
              key={index}
              style={[
                styles.ballMarker,
                {
                  left: ball.x - ball.radius,
                  top: ball.y - ball.radius,
                  width: ball.radius * 2,
                  height: ball.radius * 2,
                  borderRadius: ball.radius,
                  opacity: 0.3 + (index / detectedBalls.length) * 0.7,
                },
              ]}
            >
              <Text style={styles.ballConfidence}>{Math.round(ball.confidence)}%</Text>
            </View>
          ))}

          {/* 测试模式标识 */}
          <View style={styles.modeIndicator}>
            <Text style={styles.modeText}>
              {testMode === 'preview' && '预览模式'}
              {testMode === 'tracking' && '追踪中...'}
              {testMode === 'results' && '测试结果'}
            </Text>
            {isRecording && (
              <View style={styles.recordingDot} />
            )}
          </View>

          {/* 实时统计 */}
          {testMode === 'tracking' && (
            <View style={styles.liveStats}>
              <Text style={styles.statText}>FPS: {stats.avgFPS}</Text>
              <Text style={styles.statText}>检测: {stats.ballsDetected}</Text>
              <Text style={styles.statText}>帧数: {stats.framesProcessed}</Text>
            </View>
          )}
        </View>

        {/* 控制面板 */}
        <View style={styles.controlPanel}>
          {/* 颜色参数显示 */}
          <View style={styles.colorInfo}>
            <Text style={styles.colorInfoTitle}>网球颜色范围 (HSV)</Text>
            <Text style={styles.colorInfoText}>
              H: {TENNIS_BALL_COLOR.hue.min}-{TENNIS_BALL_COLOR.hue.max} |
              S: {TENNIS_BALL_COLOR.saturation.min}-{TENNIS_BALL_COLOR.saturation.max} |
              V: {TENNIS_BALL_COLOR.value.min}-{TENNIS_BALL_COLOR.value.max}
            </Text>
          </View>

          {/* 测试结果 */}
          {testMode === 'results' && (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>测试结果</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>处理帧数:</Text>
                <Text style={styles.resultValue}>{stats.framesProcessed}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>检测次数:</Text>
                <Text style={styles.resultValue}>{stats.ballsDetected}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>平均 FPS:</Text>
                <Text style={styles.resultValue}>{stats.avgFPS}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>检测率:</Text>
                <Text style={styles.resultValue}>
                  {stats.framesProcessed > 0
                    ? Math.round((stats.ballsDetected / stats.framesProcessed) * 100)
                    : 0}%
                </Text>
              </View>
            </View>
          )}

          {/* 调试日志 */}
          <ScrollView style={styles.logContainer}>
            {debugInfo.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>

          {/* 按钮组 */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={toggleCameraFacing}
            >
              <Text style={styles.secondaryButtonText}>切换摄像头</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={runManualTest}
            >
              <Text style={styles.secondaryButtonText}>颜色测试</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonGroup}>
            {testMode === 'preview' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={startTracking}
              >
                <Text style={styles.primaryButtonText}>开始测试</Text>
              </TouchableOpacity>
            )}

            {testMode === 'tracking' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={stopTracking}
              >
                <Text style={styles.primaryButtonText}>停止测试</Text>
              </TouchableOpacity>
            )}

            {testMode === 'results' && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={startTracking}
                >
                  <Text style={styles.primaryButtonText}>重新测试</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={() => setTestMode('preview')}
                >
                  <Text style={styles.secondaryButtonText}>返回预览</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 提示信息 */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>测试提示:</Text>
            <Text style={styles.tipsText}>1. 确保光线充足</Text>
            <Text style={styles.tipsText}>2. 将摄像头对准球场</Text>
            <Text style={styles.tipsText}>3. 测试时移动网球</Text>
            <Text style={styles.tipsText}>4. 观察检测标记是否准确跟踪球</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    height: SCREEN_HEIGHT * 0.45,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  ballMarker: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballConfidence: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modeIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginLeft: 8,
  },
  liveStats: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 8,
  },
  statText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  controlPanel: {
    flex: 1,
    padding: 16,
  },
  colorInfo: {
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  colorInfoTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  colorInfoText: {
    color: '#10B981',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  resultsCard: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  resultsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  resultValue: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    maxHeight: 100,
    backgroundColor: '#0D1117',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  logText: {
    color: '#8B949E',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#374151',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tipsContainer: {
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
  },
  tipsTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4,
  },
});
