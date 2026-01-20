import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { trainingApi } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

const TRAINING_TYPES: { [key: string]: { name: string; icon: string; color: string } } = {
  serve: { name: '发球练习', icon: '🎾', color: '#EF4444' },
  forehand: { name: '正手击球', icon: '💪', color: '#F59E0B' },
  backhand: { name: '反手击球', icon: '🏃', color: '#10B981' },
  volley: { name: '网前截击', icon: '⚡', color: '#3B82F6' },
  rally: { name: '底线对抗', icon: '🔄', color: '#8B5CF6' },
};

export default function TrainingSessionScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { user } = useAuthStore();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [duration, setDuration] = useState(0);
  const [totalShots, setTotalShots] = useState(0);
  const [successfulShots, setSuccessfulShots] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeInfo = TRAINING_TYPES[type || 'serve'];

  useEffect(() => {
    startSession();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startSession = async () => {
    if (!user?.id || !type) return;

    try {
      const session = await trainingApi.startSession(user.id, type);
      setSessionId(session.id);
      setIsRunning(true);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const recordShot = (success: boolean) => {
    setTotalShots((t) => t + 1);
    if (success) {
      setSuccessfulShots((s) => s + 1);
    }
  };

  const pauseSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
  };

  const resumeSession = () => {
    setIsRunning(true);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  };

  const endSession = async () => {
    if (!sessionId) {
      router.back();
      return;
    }

    pauseSession();

    Alert.alert('结束训练', '确定要结束本次训练吗？', [
      { text: '取消', onPress: resumeSession },
      {
        text: '结束',
        onPress: async () => {
          try {
            await trainingApi.updateSession(sessionId, {
              duration,
              totalShots,
              successfulShots,
            });
            router.back();
          } catch (error) {
            console.error('Failed to end session:', error);
            router.back();
          }
        },
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const successRate = totalShots > 0 ? Math.round((successfulShots / totalShots) * 100) : 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: typeInfo.name,
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity onPress={endSession}>
              <Text style={styles.endButton}>结束</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 训练类型图标 */}
        <View style={[styles.iconContainer, { backgroundColor: typeInfo.color + '20' }]}>
          <Text style={styles.icon}>{typeInfo.icon}</Text>
        </View>

        {/* 计时器 */}
        <View style={styles.timerContainer}>
          <Text style={styles.timer}>{formatTime(duration)}</Text>
          <Text style={styles.timerLabel}>训练时长</Text>
        </View>

        {/* 统计数据 */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalShots}</Text>
            <Text style={styles.statLabel}>总击球</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{successfulShots}</Text>
            <Text style={styles.statLabel}>成功</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{successRate}%</Text>
            <Text style={styles.statLabel}>成功率</Text>
          </View>
        </View>

        {/* 记录按钮 */}
        <View style={styles.recordButtons}>
          <TouchableOpacity
            style={[styles.recordButton, styles.successButton]}
            onPress={() => recordShot(true)}
          >
            <Text style={styles.recordButtonIcon}>✓</Text>
            <Text style={styles.recordButtonText}>成功</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.recordButton, styles.failButton]}
            onPress={() => recordShot(false)}
          >
            <Text style={styles.recordButtonIcon}>✗</Text>
            <Text style={styles.recordButtonText}>失误</Text>
          </TouchableOpacity>
        </View>

        {/* 暂停/继续按钮 */}
        <TouchableOpacity
          style={styles.pauseButton}
          onPress={isRunning ? pauseSession : resumeSession}
        >
          <Text style={styles.pauseButtonText}>{isRunning ? '⏸ 暂停' : '▶ 继续'}</Text>
        </TouchableOpacity>

        {/* 提示 */}
        <Text style={styles.hint}>点击&quot;成功&quot;或&quot;失误&quot;记录每次击球结果</Text>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    paddingTop: 30,
  },
  endButton: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    fontSize: 48,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timer: {
    fontSize: 64,
    fontWeight: '300',
    color: '#1F2937',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 40,
    width: '90%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  recordButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 30,
  },
  recordButton: {
    flex: 1,
    height: 120,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  failButton: {
    backgroundColor: '#EF4444',
  },
  recordButtonIcon: {
    fontSize: 36,
    color: '#fff',
    marginBottom: 8,
  },
  recordButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  pauseButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#E5E7EB',
  },
  pauseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: '#9CA3AF',
  },
});
