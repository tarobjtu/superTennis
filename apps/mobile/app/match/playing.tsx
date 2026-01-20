import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useMatchStore } from '../../src/stores/matchStore';
import { useAuthStore } from '../../src/stores/authStore';
import { videosApi } from '../../src/services/api';
import {
  ensureVideoDirectory,
  generateVideoFileName,
  VIDEO_DIRECTORY,
  formatDuration as formatVideoDuration,
} from '../../src/services/videoRecorder';
import { BallLandingResult } from '../../src/services/hawkEye';
import { tennisAI, AIAnalysisResult } from '../../src/services/tennisAI';
import { frameProcessor, ProcessingState } from '../../src/services/frameProcessor';
import { DetectedBall } from '../../src/services/ballDetection';

// 网球比分映射
const POINT_DISPLAY = ['0', '15', '30', '40'];

export default function PlayingScreen() {
  const {
    matchId,
    settings,
    score,
    duration,
    startMatch,
    updateScore,
    undoScore,
    setDuration,
    finishMatch,
  } = useMatchStore();
  const { user } = useAuthStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [hawkEyeResult, setHawkEyeResult] = useState<BallLandingResult | null>(null);
  const [showHawkEye, setShowHawkEye] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoScoreEnabled, setAutoScoreEnabled] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'tracking' | 'bounce_detected'>('idle');
  const [lastBounceResult, setLastBounceResult] = useState<{
    isIn: boolean;
    position: { x: number; y: number };
  } | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [detectedBall, setDetectedBall] = useState<DetectedBall | null>(null);
  const hawkEyeAnim = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);
  const videoUriRef = useRef<string | null>(null);

  // 开始比赛并启动计时器
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startMatch();
      ensureVideoDirectory();
    }

    timerRef.current = setInterval(() => {
      setDuration(duration + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (aiIntervalRef.current) {
        clearInterval(aiIntervalRef.current);
      }
    };
  }, [duration]);

  // AI 自动追踪和记分 - 使用帧处理器
  useEffect(() => {
    if (!autoScoreEnabled || !cameraReady) {
      frameProcessor.stop();
      setAiStatus('idle');
      setDetectedBall(null);
      return;
    }

    // 设置摄像头引用
    frameProcessor.setCameraRef(cameraRef);

    // 设置状态变化回调
    frameProcessor.setOnStateChange((state: ProcessingState) => {
      setProcessingState(state);
      if (state.isProcessing) {
        setAiStatus(state.lastBounceDetected ? 'bounce_detected' : 'tracking');
      }
    });

    // 设置球检测回调
    frameProcessor.setOnBallDetected((ball: DetectedBall) => {
      setDetectedBall(ball);
    });

    // 设置落地检测回调 - 连接到自动记分
    frameProcessor.setOnBounceDetected((position: { x: number; y: number }, isIn: boolean) => {
      setLastBounceResult({ isIn, position });
      setAiStatus('bounce_detected');

      // 自动记分逻辑
      // 如果球出界，对方得分
      // 注意：这里简化处理，实际应该根据谁发球/谁打出这个球来决定
      if (!isIn && !score.isFinished) {
        // 出界了，显示提示但不自动记分（让用户确认）
        Alert.alert('检测到出界', 'AI 检测到球落在界外，是否记分给对方？', [
          { text: '取消', style: 'cancel' },
          { text: '对方得分', onPress: () => updateScore(2) },
          { text: '我得分', onPress: () => updateScore(1) },
        ]);
      }

      // 3秒后恢复追踪状态
      setTimeout(() => {
        setAiStatus('tracking');
        setLastBounceResult(null);
        // 开始新的分
        tennisAI.startNewPoint();
      }, 3000);
    });

    // 启动帧处理
    frameProcessor.start();
    setAiStatus('tracking');

    return () => {
      frameProcessor.stop();
    };
  }, [autoScoreEnabled, cameraReady, score.isFinished, updateScore]);

  // 监听比赛结束
  useEffect(() => {
    if (score.isFinished) {
      handleMatchEnd();
    }
  }, [score.isFinished]);

  // 开始录制
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || isRecording) return;

    try {
      setIsRecording(true);
      const fileName = generateVideoFileName(matchId || 'unknown');
      const videoUri = VIDEO_DIRECTORY + fileName;

      const video = await cameraRef.current.recordAsync({
        maxDuration: 7200, // 最长2小时
      });

      if (video?.uri) {
        // 移动到我们的目录
        await FileSystem.moveAsync({
          from: video.uri,
          to: videoUri,
        });
        videoUriRef.current = videoUri;
        console.log('Video saved to:', videoUri);
      }
    } catch (error) {
      console.error('Recording error:', error);
      setIsRecording(false);
    }
  }, [cameraReady, isRecording, matchId]);

  // 停止录制
  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  }, [isRecording]);

  // 比赛结束处理
  const handleMatchEnd = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // 停止录制
    await stopRecording();

    // 保存视频记录到服务器
    if (videoUriRef.current && matchId && user?.id) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(videoUriRef.current);
        const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

        await videosApi.create({
          matchId,
          userId: user.id,
          filePath: videoUriRef.current,
          duration,
          fileSize,
        });
      } catch (error) {
        console.error('Failed to save video record:', error);
      }
    }

    // 保存比赛结果
    await finishMatch();

    setTimeout(() => {
      router.replace('/match/result');
    }, 1500);
  };

  // 相机准备好后自动开始录制
  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
    // 自动开始录制
    setTimeout(() => {
      startRecording();
    }, 500);
  }, [startRecording]);

  // 显示当前分数
  const getPointDisplay = () => {
    if (settings.setFormat === 'tiebreak10') {
      return `${score.player1Points} - ${score.player2Points}`;
    }
    if (score.isTiebreak) {
      return `${score.tiebreakPoints[0]} - ${score.tiebreakPoints[1]}`;
    }
    if (score.isDeuce) {
      if (score.player1Points === score.player2Points) {
        return 'DEUCE';
      }
      return score.player1Points > score.player2Points ? 'AD - 40' : '40 - AD';
    }
    return `${POINT_DISPLAY[Math.min(score.player1Points, 3)]} - ${POINT_DISPLAY[Math.min(score.player2Points, 3)]}`;
  };

  // 撤销得分
  const handleUndo = () => {
    undoScore();
  };

  // 查看回放
  const handleReplay = () => {
    router.push('/match/replay');
  };

  // AI 鹰眼判定
  const handleHawkEye = async () => {
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setShowHawkEye(true);

    // 动画效果
    Animated.sequence([
      Animated.timing(hawkEyeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      // 使用真实的 AI 分析
      const result = tennisAI.analyzeHawkEye();
      setHawkEyeResult(result);
    } catch (error) {
      console.error('Hawk-Eye analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dismissHawkEye = () => {
    Animated.timing(hawkEyeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowHawkEye(false);
      setHawkEyeResult(null);
    });
  };

  const confirmHawkEyeResult = (isIn: boolean) => {
    if (isIn) {
      // 界内，继续比赛
    } else {
      // 出界，可能需要撤销得分
    }
    dismissHawkEye();
  };

  // 暂停比赛
  const handlePause = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    Alert.alert('比赛已暂停', '', [
      {
        text: '继续比赛',
        style: 'cancel',
        onPress: () => {
          // 继续计时
        },
      },
      { text: '查看统计', onPress: () => {} },
      {
        text: '结束比赛',
        style: 'destructive',
        onPress: () => {
          handleMatchEnd();
        },
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const player1Name = settings.player1Name || '你';
  const player2Name = settings.player2Name || '对手';

  // 请求相机权限
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>正在请求相机权限...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>需要相机权限</Text>
          <Text style={styles.permissionText}>录制比赛视频需要使用相机，请授予相机权限</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>授予权限</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={() => setCameraReady(true)}>
            <Text style={styles.skipButtonText}>跳过录制，继续比赛</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部录制状态栏 */}
      <View style={styles.recordingBar}>
        <View style={styles.recordingIndicator}>
          <View style={[styles.recordingDot, isRecording && styles.recordingDotActive]} />
          <Text style={styles.recordingText}>
            {isRecording ? 'REC' : 'READY'} {formatTime(duration)}
          </Text>
        </View>
        <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
          <Text style={styles.pauseButtonText}>⏸ 暂停</Text>
        </TouchableOpacity>
      </View>

      {/* AI 控制栏 */}
      <View style={styles.aiControlBar}>
        {/* AI 状态指示器 */}
        <View
          style={[
            styles.aiIndicatorBar,
            aiStatus === 'tracking' && styles.aiIndicatorBarTracking,
            aiStatus === 'bounce_detected' && styles.aiIndicatorBarBounce,
          ]}
        >
          <Text style={styles.aiIndicatorBarText}>
            {aiStatus === 'idle' && '🎾 AI 待机'}
            {aiStatus === 'tracking' &&
              `🎾 AI 追踪中${processingState ? ` (${processingState.fps} FPS)` : '...'}`}
            {aiStatus === 'bounce_detected' && (lastBounceResult?.isIn ? '✅ 界内' : '❌ 出界')}
          </Text>
        </View>

        {/* 自动记分开关 */}
        <View style={styles.autoScoreSwitchBar}>
          <Text style={styles.autoScoreSwitchLabel}>自动记分</Text>
          <Switch
            value={autoScoreEnabled}
            onValueChange={setAutoScoreEnabled}
            trackColor={{ false: '#374151', true: '#10B981' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* 相机预览区域 */}
      <View style={styles.cameraContainer}>
        {permission.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="video"
            onCameraReady={handleCameraReady}
          >
            <View style={styles.cameraOverlay}>
              {/* 检测到的球位置标记 */}
              {detectedBall && autoScoreEnabled && (
                <View
                  style={[
                    styles.ballMarker,
                    {
                      left: detectedBall.x - 10,
                      top: detectedBall.y - 10,
                    },
                  ]}
                />
              )}

              {/* 调试信息 */}
              {__DEV__ && processingState && autoScoreEnabled && (
                <View style={styles.debugInfo}>
                  <Text style={styles.debugText}>
                    帧: {processingState.framesProcessed} | 球:{' '}
                    {processingState.detectedBalls.length}
                  </Text>
                </View>
              )}
            </View>
          </CameraView>
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraPlaceholderText}>📹</Text>
            <Text style={styles.cameraPlaceholderLabel}>相机未就绪</Text>
          </View>
        )}
      </View>

      {/* 比分面板 */}
      <View style={styles.scorePanel}>
        <View style={styles.setLabel}>
          <Text style={styles.setLabelText}>
            {settings.setFormat === 'tiebreak10'
              ? '抢十'
              : score.isTiebreak
                ? '抢七'
                : `第${score.currentSet + 1}盘`}
          </Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.playerScore}>
            <Text style={styles.playerIcon}>👤</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {player1Name}
            </Text>
            <Text style={styles.gamesText}>
              {settings.setFormat === 'tiebreak10' ? '' : score.player1Games[score.currentSet]}
            </Text>
            <Text style={styles.pointsText}>
              {settings.setFormat === 'tiebreak10'
                ? score.player1Points
                : score.isTiebreak
                  ? score.tiebreakPoints[0]
                  : POINT_DISPLAY[Math.min(score.player1Points, 3)]}
            </Text>
          </View>

          <View style={styles.scoreDivider} />

          <View style={styles.playerScore}>
            <Text style={styles.playerIcon}>👤</Text>
            <Text style={styles.playerName} numberOfLines={1}>
              {player2Name}
            </Text>
            <Text style={styles.gamesText}>
              {settings.setFormat === 'tiebreak10' ? '' : score.player2Games[score.currentSet]}
            </Text>
            <Text style={styles.pointsText}>
              {settings.setFormat === 'tiebreak10'
                ? score.player2Points
                : score.isTiebreak
                  ? score.tiebreakPoints[1]
                  : POINT_DISPLAY[Math.min(score.player2Points, 3)]}
            </Text>
          </View>
        </View>

        {score.isDeuce && !score.isTiebreak && settings.setFormat !== 'tiebreak10' && (
          <Text style={styles.deuceText}>DEUCE</Text>
        )}

        {/* 已完成的盘比分 */}
        {score.currentSet > 0 && settings.setFormat !== 'tiebreak10' && (
          <View style={styles.setsHistory}>
            {score.player1Games.slice(0, score.currentSet).map((g1, i) => (
              <Text key={i} style={styles.setsHistoryText}>
                {g1}-{score.player2Games[i]}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* 计分按钮 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.scoreButton, styles.player1Button]}
          onPress={() => updateScore(1)}
          disabled={score.isFinished}
        >
          <Text style={styles.scoreButtonLabel}>🟢 我</Text>
          <Text style={styles.scoreButtonText}>{player1Name}得分</Text>
          <Text style={styles.scoreButtonPlus}>+1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.scoreButton, styles.player2Button]}
          onPress={() => updateScore(2)}
          disabled={score.isFinished}
        >
          <Text style={styles.scoreButtonLabel}>🟣 对手</Text>
          <Text style={styles.scoreButtonText}>{player2Name}得分</Text>
          <Text style={styles.scoreButtonPlus}>+1</Text>
        </TouchableOpacity>
      </View>

      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolButton} onPress={handleHawkEye}>
          <Text style={styles.toolButtonIcon}>👁️</Text>
          <Text style={styles.toolButtonText}>鹰眼挑战</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolButton} onPress={handleReplay}>
          <Text style={styles.toolButtonIcon}>📹</Text>
          <Text style={styles.toolButtonText}>查看回放</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolButton} onPress={handleUndo}>
          <Text style={styles.toolButtonIcon}>↩️</Text>
          <Text style={styles.toolButtonText}>撤销</Text>
        </TouchableOpacity>
      </View>

      {/* 比赛结束提示 */}
      {score.isFinished && (
        <View style={styles.matchEndOverlay}>
          <Text style={styles.matchEndText}>
            🏆 {score.winner === 1 ? player1Name : player2Name} 获胜!
          </Text>
        </View>
      )}

      {/* 鹰眼结果覆盖层 */}
      {showHawkEye && (
        <Animated.View
          style={[
            styles.hawkEyeOverlay,
            {
              opacity: hawkEyeAnim,
              transform: [
                {
                  scale: hawkEyeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.hawkEyeContent}>
            {isAnalyzing ? (
              <>
                <View style={styles.hawkEyeAnalyzing}>
                  <Text style={styles.hawkEyeIcon}>👁️</Text>
                  <Text style={styles.hawkEyeTitle}>AI 鹰眼分析中...</Text>
                  <View style={styles.hawkEyeLoader}>
                    <View style={styles.hawkEyeLoaderDot} />
                    <View style={[styles.hawkEyeLoaderDot, { opacity: 0.6 }]} />
                    <View style={[styles.hawkEyeLoaderDot, { opacity: 0.3 }]} />
                  </View>
                </View>
              </>
            ) : hawkEyeResult ? (
              <>
                <View
                  style={[
                    styles.hawkEyeResultBadge,
                    hawkEyeResult.isIn ? styles.hawkEyeIn : styles.hawkEyeOut,
                  ]}
                >
                  <Text style={styles.hawkEyeResultIcon}>{hawkEyeResult.isIn ? '✓' : '✗'}</Text>
                  <Text style={styles.hawkEyeResultText}>{hawkEyeResult.isIn ? 'IN' : 'OUT'}</Text>
                </View>

                <View style={styles.hawkEyeDetails}>
                  <View style={styles.hawkEyeDetailItem}>
                    <Text style={styles.hawkEyeDetailLabel}>置信度</Text>
                    <Text style={styles.hawkEyeDetailValue}>
                      {Math.round(hawkEyeResult.confidence)}%
                    </Text>
                  </View>
                  <View style={styles.hawkEyeDetailDivider} />
                  <View style={styles.hawkEyeDetailItem}>
                    <Text style={styles.hawkEyeDetailLabel}>距边线</Text>
                    <Text
                      style={[
                        styles.hawkEyeDetailValue,
                        { color: hawkEyeResult.isIn ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {Math.abs(hawkEyeResult.distanceFromLine).toFixed(1)}mm
                      {hawkEyeResult.isIn ? ' 界内' : ' 出界'}
                    </Text>
                  </View>
                </View>

                <View style={styles.hawkEyeActions}>
                  <TouchableOpacity
                    style={[styles.hawkEyeButton, styles.hawkEyeButtonIn]}
                    onPress={() => confirmHawkEyeResult(true)}
                  >
                    <Text style={styles.hawkEyeButtonText}>界内 (IN)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.hawkEyeButton, styles.hawkEyeButtonOut]}
                    onPress={() => confirmHawkEyeResult(false)}
                  >
                    <Text style={styles.hawkEyeButtonText}>出界 (OUT)</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.hawkEyeReplay} onPress={handleReplay}>
                  <Text style={styles.hawkEyeReplayText}>📹 查看慢动作回放</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity style={styles.hawkEyeClose} onPress={dismissHawkEye}>
              <Text style={styles.hawkEyeCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
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
    padding: 40,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  permissionText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    padding: 12,
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
  recordingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6B7280',
    marginRight: 8,
  },
  recordingDotActive: {
    backgroundColor: '#EF4444',
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pauseButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pauseButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  aiControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1F2937',
    marginHorizontal: 10,
    marginTop: 5,
    borderRadius: 12,
  },
  aiIndicatorBar: {
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  aiIndicatorBarTracking: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  aiIndicatorBarBounce: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    borderColor: '#F59E0B',
  },
  aiIndicatorBarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  autoScoreSwitchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraContainer: {
    height: 180,
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 12,
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholderText: {
    fontSize: 48,
    marginBottom: 8,
  },
  cameraPlaceholderLabel: {
    color: '#6B7280',
    fontSize: 14,
  },
  autoScoreSwitchLabel: {
    color: '#fff',
    fontSize: 13,
    marginRight: 8,
  },
  ballMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.8)',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  debugInfo: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  debugText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scorePanel: {
    backgroundColor: '#1F2937',
    margin: 10,
    borderRadius: 16,
    padding: 20,
  },
  setLabel: {
    alignItems: 'center',
    marginBottom: 15,
  },
  setLabelText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerScore: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playerIcon: {
    fontSize: 20,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 50,
  },
  gamesText: {
    color: '#10B981',
    fontSize: 28,
    fontWeight: '700',
    minWidth: 25,
    textAlign: 'center',
  },
  pointsText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'center',
  },
  scoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#374151',
  },
  deuceText: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
  },
  setsHistory: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  setsHistoryText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  scoreButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  player1Button: {
    backgroundColor: '#10B981',
  },
  player2Button: {
    backgroundColor: '#6366F1',
  },
  scoreButtonLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginBottom: 4,
  },
  scoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scoreButtonPlus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    padding: 10,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  toolButtonIcon: {
    fontSize: 18,
  },
  toolButtonText: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  matchEndOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchEndText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  // 鹰眼样式
  hawkEyeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hawkEyeContent: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 30,
    width: '90%',
    alignItems: 'center',
  },
  hawkEyeClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hawkEyeCloseText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  hawkEyeAnalyzing: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  hawkEyeIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  hawkEyeTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  hawkEyeLoader: {
    flexDirection: 'row',
    gap: 8,
  },
  hawkEyeLoaderDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  hawkEyeResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  hawkEyeIn: {
    backgroundColor: '#065F46',
  },
  hawkEyeOut: {
    backgroundColor: '#7F1D1D',
  },
  hawkEyeResultIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    marginRight: 12,
  },
  hawkEyeResultText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  hawkEyeDetails: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  hawkEyeDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  hawkEyeDetailDivider: {
    width: 1,
    backgroundColor: '#4B5563',
    marginHorizontal: 16,
  },
  hawkEyeDetailLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4,
  },
  hawkEyeDetailValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hawkEyeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  hawkEyeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  hawkEyeButtonIn: {
    backgroundColor: '#10B981',
  },
  hawkEyeButtonOut: {
    backgroundColor: '#EF4444',
  },
  hawkEyeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hawkEyeReplay: {
    paddingVertical: 12,
  },
  hawkEyeReplayText: {
    color: '#60A5FA',
    fontSize: 15,
  },
});
