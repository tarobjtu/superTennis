/**
 * AI 演示模式 - 视频测试页面
 * 用于在 Simulator 中测试 AI 鹰眼和自动记分功能
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { tennisAI, AIAnalysisResult, MatchEvent } from '../../src/services/tennisAI';
import { BallLandingResult } from '../../src/services/hawkEye';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 模拟数据生成器
const generateMockBounce = (): { x: number; y: number; isIn: boolean } => {
  // 模拟网球场区域内的随机位置
  const x = Math.random() * 300 + 50;
  const y = Math.random() * 400 + 100;
  // 80% 概率在界内
  const isIn = Math.random() > 0.2;
  return { x, y, isIn };
};

export default function DemoScreen() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<AIAnalysisResult[]>([]);
  const [currentResult, setCurrentResult] = useState<AIAnalysisResult | null>(null);
  const [hawkEyeResult, setHawkEyeResult] = useState<BallLandingResult | null>(null);
  const [showHawkEye, setShowHawkEye] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [simulationMode, setSimulationMode] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });

  const videoRef = useRef<Video>(null);
  const hawkEyeAnim = useRef(new Animated.Value(0)).current;
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 初始化 AI
    tennisAI.reset();
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // 选择视频
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
      setAiResults([]);
      setEvents([]);
      tennisAI.reset();
    }
  };

  // 视频播放状态变化
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);

      // 模拟 AI 分析 - 每隔一段时间检测
      if (status.isPlaying && isAnalyzing && status.positionMillis) {
        // 模拟检测到球
        const mockX = 100 + Math.random() * 200;
        const mockY = 100 + Math.random() * 300;
        const result = tennisAI.processDetection(mockX, mockY, 0.8 + Math.random() * 0.2);
        setCurrentResult(result);
        setAiResults((prev) => [...prev.slice(-30), result]);

        if (result.bounceDetected) {
          setEvents(tennisAI.getMatchEvents());
        }
      }
    }
  };

  // 开始 AI 分析
  const startAnalysis = () => {
    setIsAnalyzing(true);
    tennisAI.startNewPoint();
    Alert.alert('AI 分析已开启', '播放视频时会自动检测网球位置和落点');
  };

  // 停止 AI 分析
  const stopAnalysis = () => {
    setIsAnalyzing(false);
    setCurrentResult(null);
  };

  // 模拟模式 - 不需要视频，直接生成模拟数据
  const startSimulation = () => {
    setSimulationMode(true);
    setIsAnalyzing(true);
    tennisAI.reset();
    tennisAI.startNewPoint();

    let frameCount = 0;
    simulationIntervalRef.current = setInterval(() => {
      frameCount++;

      // 模拟球的移动轨迹
      const t = frameCount / 30; // 时间（秒）
      const x = 200 + Math.sin(t * 2) * 100;
      const y = 150 + t * 50;

      const result = tennisAI.processDetection(x, y, 0.85 + Math.random() * 0.1);
      setCurrentResult(result);
      setAiResults((prev) => [...prev.slice(-50), result]);

      // 每 3 秒模拟一次落地
      if (frameCount % 90 === 0) {
        const bounce = generateMockBounce();
        tennisAI.processDetection(bounce.x, bounce.y, 0.95);

        // 更新事件
        setEvents(tennisAI.getMatchEvents());

        // 自动记分
        if (!bounce.isIn) {
          // 出界，对方得分
          setScore((prev) => ({
            ...prev,
            player2: prev.player2 + 1,
          }));
          showBounceAlert(bounce.isIn, bounce);
        } else if (Math.random() > 0.5) {
          // 界内，随机决定谁得分
          const winner = Math.random() > 0.5 ? 1 : 2;
          setScore((prev) => ({
            ...prev,
            [winner === 1 ? 'player1' : 'player2']: prev[winner === 1 ? 'player1' : 'player2'] + 1,
          }));
        }

        // 开始新的分
        tennisAI.startNewPoint();
      }
    }, 1000 / 30); // 30 FPS
  };

  const stopSimulation = () => {
    setSimulationMode(false);
    setIsAnalyzing(false);
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

  // 显示落地提示
  const showBounceAlert = (isIn: boolean, position: { x: number; y: number }) => {
    Alert.alert(
      isIn ? '✅ 界内 (IN)' : '❌ 出界 (OUT)',
      `落点位置: (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`,
      [{ text: '确定', style: 'default' }]
    );
  };

  // 触发鹰眼判定
  const triggerHawkEye = () => {
    setShowHawkEye(true);

    Animated.timing(hawkEyeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // 模拟分析延迟
    setTimeout(() => {
      const result = tennisAI.analyzeHawkEye();
      if (result) {
        setHawkEyeResult(result);
      } else {
        // 如果没有真实数据，生成模拟数据
        const mockResult: BallLandingResult = {
          isIn: Math.random() > 0.3,
          confidence: 85 + Math.random() * 12,
          distanceFromLine: Math.random() * 50 - 25,
          landingPoint: { x: Math.random() * 10 - 5, y: Math.random() * 20 - 10 },
          lineType: ['baseline', 'sideline', 'service_line'][Math.floor(Math.random() * 3)] as any,
          timestamp: Date.now(),
        };
        setHawkEyeResult(mockResult);
      }
    }, 1500);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 标题栏 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🎾 AI 演示模式</Text>
        </View>

        {/* 说明文字 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            在 Simulator 中测试 AI 鹰眼和自动记分功能。
            {'\n'}可以选择视频文件或使用模拟模式。
          </Text>
        </View>

        {/* 模式选择 */}
        <View style={styles.modeSection}>
          <Text style={styles.sectionTitle}>选择测试模式</Text>

          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[styles.modeButton, simulationMode && styles.modeButtonActive]}
              onPress={simulationMode ? stopSimulation : startSimulation}
            >
              <Text style={styles.modeButtonIcon}>🎮</Text>
              <Text style={styles.modeButtonText}>{simulationMode ? '停止模拟' : '模拟模式'}</Text>
              <Text style={styles.modeButtonDesc}>自动生成测试数据</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeButton} onPress={pickVideo}>
              <Text style={styles.modeButtonIcon}>📹</Text>
              <Text style={styles.modeButtonText}>选择视频</Text>
              <Text style={styles.modeButtonDesc}>从相册导入网球视频</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 视频播放区 */}
        {videoUri && (
          <View style={styles.videoSection}>
            <Text style={styles.sectionTitle}>视频分析</Text>
            <View style={styles.videoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              />

              {/* AI 检测叠加层 */}
              {currentResult?.ballDetected && (
                <View
                  style={[
                    styles.ballIndicator,
                    {
                      left: currentResult.ballPosition!.x - 10,
                      top: currentResult.ballPosition!.y - 10,
                    },
                  ]}
                />
              )}
            </View>

            <View style={styles.videoControls}>
              <TouchableOpacity
                style={[styles.controlButton, isAnalyzing && styles.controlButtonActive]}
                onPress={isAnalyzing ? stopAnalysis : startAnalysis}
              >
                <Text style={styles.controlButtonText}>
                  {isAnalyzing ? '🔴 停止分析' : '🟢 开始分析'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 模拟模式显示区 */}
        {simulationMode && (
          <View style={styles.simulationSection}>
            <Text style={styles.sectionTitle}>模拟比赛进行中...</Text>

            {/* 模拟比分 */}
            <View style={styles.scoreBoard}>
              <View style={styles.scorePlayer}>
                <Text style={styles.scoreLabel}>玩家 1</Text>
                <Text style={styles.scoreValue}>{score.player1}</Text>
              </View>
              <Text style={styles.scoreDivider}>-</Text>
              <View style={styles.scorePlayer}>
                <Text style={styles.scoreLabel}>玩家 2</Text>
                <Text style={styles.scoreValue}>{score.player2}</Text>
              </View>
            </View>

            {/* 当前 AI 状态 */}
            <View style={styles.aiStatusBox}>
              <Text style={styles.aiStatusLabel}>AI 状态</Text>
              <Text style={styles.aiStatusText}>
                {currentResult?.bounceDetected
                  ? `⚡ 检测到落地 - ${currentResult.isInBounds ? '界内' : '出界'}`
                  : currentResult?.ballDetected
                    ? '🎾 追踪中...'
                    : '⏳ 等待检测...'}
              </Text>
              {currentResult?.estimatedSpeed && (
                <Text style={styles.aiSpeedText}>
                  预估球速: {currentResult.estimatedSpeed.toFixed(0)} km/h
                </Text>
              )}
            </View>

            {/* 模拟球场 */}
            <View style={styles.courtSimulation}>
              <View style={styles.courtLines}>
                <View style={styles.courtBaseline} />
                <View style={styles.courtServiceLine} />
                <View style={styles.courtCenterLine} />
              </View>
              {currentResult?.ballPosition && (
                <View
                  style={[
                    styles.simulatedBall,
                    {
                      left: currentResult.ballPosition.x * 0.8,
                      top: currentResult.ballPosition.y * 0.4,
                    },
                  ]}
                />
              )}
            </View>
          </View>
        )}

        {/* 鹰眼测试 */}
        <View style={styles.hawkEyeSection}>
          <Text style={styles.sectionTitle}>鹰眼挑战</Text>
          <TouchableOpacity style={styles.hawkEyeButton} onPress={triggerHawkEye}>
            <Text style={styles.hawkEyeButtonIcon}>👁️</Text>
            <Text style={styles.hawkEyeButtonText}>触发鹰眼判定</Text>
          </TouchableOpacity>
        </View>

        {/* 事件记录 */}
        {events.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>比赛事件 ({events.length})</Text>
            <ScrollView style={styles.eventsList} nestedScrollEnabled>
              {events
                .slice(-10)
                .reverse()
                .map((event, index) => (
                  <View key={index} style={styles.eventItem}>
                    <Text style={styles.eventType}>
                      {event.type === 'bounce' && '🎾'}
                      {event.type === 'out' && '❌'}
                      {event.type === 'shot' && '🎯'}
                      {event.type === 'point_start' && '▶️'}
                      {event.type === 'point_end' && '⏹️'} {event.type}
                    </Text>
                    <Text style={styles.eventTime}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

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
            {!hawkEyeResult ? (
              <View style={styles.hawkEyeAnalyzing}>
                <Text style={styles.hawkEyeIcon}>👁️</Text>
                <Text style={styles.hawkEyeTitle}>AI 鹰眼分析中...</Text>
                <View style={styles.hawkEyeLoader}>
                  <View style={styles.hawkEyeLoaderDot} />
                  <View style={[styles.hawkEyeLoaderDot, { opacity: 0.6 }]} />
                  <View style={[styles.hawkEyeLoaderDot, { opacity: 0.3 }]} />
                </View>
              </View>
            ) : (
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
                    </Text>
                  </View>
                </View>

                <View style={styles.hawkEyeCourtPreview}>
                  <View style={styles.courtMiniLines} />
                  <View
                    style={[
                      styles.landingDot,
                      {
                        backgroundColor: hawkEyeResult.isIn ? '#10B981' : '#EF4444',
                        left: 50 + hawkEyeResult.landingPoint.x * 5,
                        top: 50 + hawkEyeResult.landingPoint.y * 2,
                      },
                    ]}
                  />
                </View>

                <TouchableOpacity style={styles.hawkEyeDismiss} onPress={dismissHawkEye}>
                  <Text style={styles.hawkEyeDismissText}>关闭</Text>
                </TouchableOpacity>
              </>
            )}

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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#60A5FA',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#1F2937',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  infoText: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modeSection: {
    padding: 16,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#065F46',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  modeButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  modeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  modeButtonDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  videoSection: {
    padding: 16,
  },
  videoContainer: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    height: 220,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  ballIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.8)',
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  videoControls: {
    marginTop: 12,
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  controlButtonActive: {
    backgroundColor: '#7F1D1D',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  simulationSection: {
    padding: 16,
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  scorePlayer: {
    alignItems: 'center',
    flex: 1,
  },
  scoreLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  scoreValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
  },
  scoreDivider: {
    color: '#6B7280',
    fontSize: 32,
    marginHorizontal: 20,
  },
  aiStatusBox: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  aiStatusLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  aiStatusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  aiSpeedText: {
    color: '#10B981',
    fontSize: 14,
    marginTop: 8,
  },
  courtSimulation: {
    backgroundColor: '#065F46',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  courtLines: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#fff',
    margin: 10,
  },
  courtBaseline: {
    position: 'absolute',
    top: '50%',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#fff',
  },
  courtServiceLine: {
    position: 'absolute',
    top: '25%',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#fff',
  },
  courtCenterLine: {
    position: 'absolute',
    left: '50%',
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: '#fff',
  },
  simulatedBall: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FBBF24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  hawkEyeSection: {
    padding: 16,
  },
  hawkEyeButton: {
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  hawkEyeButtonIcon: {
    fontSize: 32,
  },
  hawkEyeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  eventsSection: {
    padding: 16,
  },
  eventsList: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    maxHeight: 200,
    padding: 12,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  eventType: {
    color: '#fff',
    fontSize: 14,
  },
  eventTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  // 鹰眼覆盖层样式
  hawkEyeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
    marginBottom: 20,
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
  hawkEyeCourtPreview: {
    width: 120,
    height: 100,
    backgroundColor: '#065F46',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 20,
    position: 'relative',
  },
  courtMiniLines: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#fff',
  },
  landingDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  hawkEyeDismiss: {
    backgroundColor: '#374151',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  hawkEyeDismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
