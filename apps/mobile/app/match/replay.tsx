import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useMatchStore } from '../../src/stores/matchStore';
import { tennisAI, MatchEvent } from '../../src/services/tennisAI';
import { BallLandingResult } from '../../src/services/hawkEye';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReplayScreen() {
  const { videoPath } = useMatchStore();
  const videoRef = useRef<Video>(null);

  const [playbackSpeed, setPlaybackSpeed] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // AI 分析结果
  const [aiResult, setAiResult] = useState<BallLandingResult | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  // 获取 AI 分析结果
  useEffect(() => {
    const result = tennisAI.analyzeHawkEye();
    setAiResult(result);
    setMatchEvents(tennisAI.getMatchEvents());
  }, []);

  // 播放速度选项
  const speedOptions = [0.25, 0.5, 1, 2];

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setCurrentTime(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    setIsLoading(false);
  }, []);

  const togglePlay = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const changeSpeed = async (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      await videoRef.current.setRateAsync(speed, true);
    }
  };

  const seekBackward = async () => {
    if (!videoRef.current) return;
    const newPosition = Math.max(0, currentTime - 100); // 后退 100ms
    await videoRef.current.setPositionAsync(newPosition);
  };

  const seekForward = async () => {
    if (!videoRef.current) return;
    const newPosition = Math.min(duration, currentTime + 100); // 前进 100ms
    await videoRef.current.setPositionAsync(newPosition);
  };

  const previousFrame = async () => {
    if (!videoRef.current) return;
    await videoRef.current.pauseAsync();
    const newPosition = Math.max(0, currentTime - 33); // 约一帧 (30fps)
    await videoRef.current.setPositionAsync(newPosition);
  };

  const nextFrame = async () => {
    if (!videoRef.current) return;
    await videoRef.current.pauseAsync();
    const newPosition = Math.min(duration, currentTime + 33);
    await videoRef.current.setPositionAsync(newPosition);
  };

  const handleConfirmIn = () => {
    // 球在界内，当前球员得分
    // 注意：这里假设对手打出的球落在界内，所以对手得分
    // 实际逻辑可能需要根据谁挑战的来决定
    tennisAI.endPoint(1, 'winner');
    router.back();
  };

  const handleConfirmOut = () => {
    // 球出界，打球的对手失分
    tennisAI.endPoint(2, 'error');
    router.back();
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // 无视频时显示模拟界面
  const hasVideo = videoPath && videoPath.length > 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '争议回放',
          presentation: 'modal',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 视频回放区域 */}
        <View style={styles.videoContainer}>
          {hasVideo ? (
            <>
              <Video
                ref={videoRef}
                source={{ uri: videoPath }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                shouldPlay={false}
                rate={playbackSpeed}
              />
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text style={styles.loadingText}>加载视频中...</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderIcon}>🎬</Text>
              <Text style={styles.videoPlaceholderText}>慢动作回放</Text>

              {/* 落点标记（模拟） */}
              <View style={styles.ballLandingMark}>
                <View style={styles.ballDot} />
                <View style={styles.courtLine} />
              </View>
            </View>
          )}

          {/* 时间进度 */}
          <View style={styles.timeProgress}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>

          {/* 播放速度控制 */}
          <View style={styles.speedControl}>
            <Text style={styles.speedLabel}>播放速度</Text>
            <View style={styles.speedSlider}>
              {speedOptions.map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedOption,
                    playbackSpeed === speed && styles.speedOptionActive,
                  ]}
                  onPress={() => changeSpeed(speed)}
                >
                  <Text
                    style={[
                      styles.speedOptionText,
                      playbackSpeed === speed && styles.speedOptionTextActive,
                    ]}
                  >
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* AI 判定结果 */}
        <View style={[
          styles.aiResultCard,
          aiResult?.isIn ? styles.aiResultCardIn : styles.aiResultCardOut
        ]}>
          <View style={styles.aiResultHeader}>
            <Text style={styles.aiResultIcon}>🤖</Text>
            <Text style={[
              styles.aiResultTitle,
              aiResult?.isIn ? styles.aiResultTitleIn : styles.aiResultTitleOut
            ]}>
              AI 判定: {aiResult ? (aiResult.isIn ? 'IN' : 'OUT') : '分析中...'}
            </Text>
          </View>
          <View style={styles.aiResultDetails}>
            <View style={styles.aiResultItem}>
              <Text style={styles.aiResultLabel}>置信度</Text>
              <Text style={styles.aiResultValue}>
                {aiResult ? `${Math.round(aiResult.confidence)}%` : '--'}
              </Text>
            </View>
            <View style={styles.aiResultDivider} />
            <View style={styles.aiResultItem}>
              <Text style={styles.aiResultLabel}>距边线</Text>
              <Text style={styles.aiResultValue}>
                {aiResult
                  ? `约 ${(aiResult.distanceFromLine * 100).toFixed(1)}cm ${aiResult.isIn ? '(界内)' : '(出界)'}`
                  : '--'
                }
              </Text>
            </View>
          </View>
          {aiResult?.landingPoint && (
            <View style={styles.aiResultPosition}>
              <Text style={styles.aiResultLabel}>落点坐标</Text>
              <Text style={styles.aiResultValue}>
                ({aiResult.landingPoint.x.toFixed(2)}m, {aiResult.landingPoint.y.toFixed(2)}m)
              </Text>
            </View>
          )}
        </View>

        {/* 播放控制 */}
        <View style={styles.playbackControls}>
          <Text style={styles.controlsLabel}>播放控制</Text>
          <View style={styles.controlButtons}>
            <TouchableOpacity style={styles.controlButton} onPress={previousFrame}>
              <Text style={styles.controlButtonText}>|◀</Text>
              <Text style={styles.controlButtonLabel}>上一帧</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={seekBackward}>
              <Text style={styles.controlButtonText}>◀◀</Text>
              <Text style={styles.controlButtonLabel}>慢退</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={togglePlay}
            >
              <Text style={styles.controlButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
              <Text style={styles.controlButtonLabel}>{isPlaying ? '暂停' : '播放'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={seekForward}>
              <Text style={styles.controlButtonText}>▶▶</Text>
              <Text style={styles.controlButtonLabel}>慢进</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={nextFrame}>
              <Text style={styles.controlButtonText}>▶|</Text>
              <Text style={styles.controlButtonLabel}>下一帧</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 确认判定 */}
        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>请确认判定结果：</Text>
          <View style={styles.confirmButtons}>
            <TouchableOpacity style={styles.confirmButtonIn} onPress={handleConfirmIn}>
              <Text style={styles.confirmButtonIcon}>✓</Text>
              <Text style={styles.confirmButtonText}>IN</Text>
              <Text style={styles.confirmButtonSubtext}>(界内)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButtonOut} onPress={handleConfirmOut}>
              <Text style={styles.confirmButtonIcon}>✗</Text>
              <Text style={styles.confirmButtonText}>OUT</Text>
              <Text style={styles.confirmButtonSubtext}>(出界)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  videoContainer: {
    margin: 10,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#1F2937',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  videoPlaceholder: {
    height: 200,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  videoPlaceholderText: {
    color: '#6B7280',
    fontSize: 16,
  },
  ballLandingMark: {
    position: 'absolute',
    bottom: 60,
    right: 80,
    alignItems: 'center',
  },
  ballDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  courtLine: {
    width: 60,
    height: 3,
    backgroundColor: '#fff',
    marginTop: 5,
  },
  timeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  timeText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'monospace',
    minWidth: 50,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  speedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    gap: 15,
  },
  speedLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  speedSlider: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    borderRadius: 20,
    padding: 4,
  },
  speedOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  speedOptionActive: {
    backgroundColor: '#10B981',
  },
  speedOptionText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  speedOptionTextActive: {
    color: '#fff',
  },
  aiResultCard: {
    backgroundColor: '#1F2937',
    margin: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6B7280',
  },
  aiResultCardIn: {
    borderColor: '#10B981',
  },
  aiResultCardOut: {
    borderColor: '#EF4444',
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiResultIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  aiResultTitle: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '700',
  },
  aiResultTitleIn: {
    color: '#10B981',
  },
  aiResultTitleOut: {
    color: '#EF4444',
  },
  aiResultDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiResultItem: {
    flex: 1,
  },
  aiResultLabel: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 2,
  },
  aiResultValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  aiResultDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#374151',
    marginHorizontal: 15,
  },
  aiResultPosition: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playbackControls: {
    padding: 15,
  },
  controlsLabel: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 12,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  controlButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 60,
  },
  playButton: {
    backgroundColor: '#10B981',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  controlButtonLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
  },
  confirmSection: {
    padding: 15,
  },
  confirmLabel: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonIn: {
    flex: 1,
    backgroundColor: '#065F46',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  confirmButtonOut: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  confirmButtonIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  confirmButtonSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
});
