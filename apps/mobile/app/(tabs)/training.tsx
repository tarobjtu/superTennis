import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { trainingApi, TrainingSession } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

const TRAINING_TYPES = [
  { id: 'serve', name: '发球练习', icon: '🎾', color: '#EF4444', description: '提高发球速度和准确性' },
  { id: 'forehand', name: '正手击球', icon: '💪', color: '#F59E0B', description: '强化正手进攻能力' },
  { id: 'backhand', name: '反手击球', icon: '🏃', color: '#10B981', description: '提升反手稳定性' },
  { id: 'volley', name: '网前截击', icon: '⚡', color: '#3B82F6', description: '练习网前技术' },
  { id: 'rally', name: '底线对抗', icon: '🔄', color: '#8B5CF6', description: '增强底线相持能力' },
];

export default function TrainingScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      const [statsData, sessions] = await Promise.all([
        trainingApi.getStats(user.id),
        trainingApi.getSessions(user.id, undefined, 5),
      ]);
      setStats(statsData);
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Failed to load training data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const startTraining = (type: string) => {
    router.push(`/training/session?type=${type}`);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}小时${mins % 60}分`;
    }
    return `${mins}分钟`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>加载训练数据...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 头部 */}
        <View style={styles.header}>
          <Text style={styles.title}>训练模式</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/training/history')}
          >
            <Text style={styles.historyButtonText}>历史记录</Text>
          </TouchableOpacity>
        </View>

        {/* 本周统计 */}
        <View style={styles.weeklyStats}>
          <Text style={styles.weeklyTitle}>本周训练</Text>
          <View style={styles.weeklyRow}>
            <View style={styles.weeklyStat}>
              <Text style={styles.weeklyValue}>
                {stats?.weekly?.sessionCount || 0}
              </Text>
              <Text style={styles.weeklyLabel}>训练次数</Text>
            </View>
            <View style={styles.weeklyDivider} />
            <View style={styles.weeklyStat}>
              <Text style={styles.weeklyValue}>
                {formatDuration(stats?.weekly?.totalDuration || 0)}
              </Text>
              <Text style={styles.weeklyLabel}>总时长</Text>
            </View>
          </View>
        </View>

        {/* 选择训练类型 */}
        <Text style={styles.sectionTitle}>选择训练类型</Text>
        <View style={styles.trainingTypes}>
          {TRAINING_TYPES.map((type) => {
            const typeStat = stats?.byType?.find((s: any) => s.type === type.id);
            return (
              <TouchableOpacity
                key={type.id}
                style={styles.trainingCard}
                onPress={() => startTraining(type.id)}
              >
                <View style={[styles.trainingIcon, { backgroundColor: type.color + '20' }]}>
                  <Text style={styles.trainingIconText}>{type.icon}</Text>
                </View>
                <View style={styles.trainingInfo}>
                  <Text style={styles.trainingName}>{type.name}</Text>
                  <Text style={styles.trainingDesc}>{type.description}</Text>
                  {typeStat && (
                    <Text style={styles.trainingStats}>
                      已练习 {typeStat.sessionCount} 次 · 成功率 {typeStat.successRate}%
                    </Text>
                  )}
                </View>
                <Text style={styles.trainingArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 技能雷达图 (简化版) */}
        <Text style={styles.sectionTitle}>技能分析</Text>
        <View style={styles.skillsCard}>
          {stats?.byType?.length > 0 ? (
            stats.byType.map((skill: any) => {
              const typeInfo = TRAINING_TYPES.find((t) => t.id === skill.type);
              return (
                <View key={skill.type} style={styles.skillRow}>
                  <Text style={styles.skillName}>
                    {typeInfo?.icon} {typeInfo?.name || skill.type}
                  </Text>
                  <View style={styles.skillBar}>
                    <View
                      style={[
                        styles.skillProgress,
                        {
                          width: `${skill.successRate}%`,
                          backgroundColor: typeInfo?.color || '#10B981',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.skillValue}>{skill.successRate}%</Text>
                </View>
              );
            })
          ) : (
            <View style={styles.noSkillsContainer}>
              <Text style={styles.noSkillsIcon}>📊</Text>
              <Text style={styles.noSkillsText}>开始训练后显示技能分析</Text>
            </View>
          )}
        </View>

        {/* 最近训练 */}
        {recentSessions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>最近训练</Text>
            <View style={styles.recentSessions}>
              {recentSessions.map((session) => {
                const typeInfo = TRAINING_TYPES.find((t) => t.id === session.type);
                const date = new Date(session.createdAt);
                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={[styles.sessionIcon, { backgroundColor: typeInfo?.color + '20' }]}>
                      <Text style={styles.sessionIconText}>{typeInfo?.icon}</Text>
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionName}>{typeInfo?.name}</Text>
                      <Text style={styles.sessionDate}>
                        {date.toLocaleDateString('zh-CN')} · {formatDuration(session.duration)}
                      </Text>
                    </View>
                    <View style={styles.sessionResult}>
                      <Text style={styles.sessionRate}>
                        {session.totalShots > 0
                          ? Math.round((session.successfulShots / session.totalShots) * 100)
                          : 0}%
                      </Text>
                      <Text style={styles.sessionLabel}>成功率</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* 成就入口 */}
        <TouchableOpacity
          style={styles.achievementsCard}
          onPress={() => router.push('/training/achievements')}
        >
          <Text style={styles.achievementsIcon}>🏆</Text>
          <View style={styles.achievementsInfo}>
            <Text style={styles.achievementsTitle}>我的成就</Text>
            <Text style={styles.achievementsDesc}>查看已解锁的成就和里程碑</Text>
          </View>
          <Text style={styles.achievementsArrow}>›</Text>
        </TouchableOpacity>

        {/* 鹰眼测试入口 */}
        <TouchableOpacity
          style={styles.hawkEyeCard}
          onPress={() => router.push('/test/hawk-eye-test')}
        >
          <Text style={styles.hawkEyeIcon}>🦅</Text>
          <View style={styles.hawkEyeInfo}>
            <Text style={styles.hawkEyeTitle}>AI 鹰眼测试</Text>
            <Text style={styles.hawkEyeDesc}>测试摄像头球追踪和判定功能</Text>
          </View>
          <Text style={styles.hawkEyeArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  historyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  historyButtonText: {
    color: '#10B981',
    fontWeight: '600',
  },
  weeklyStats: {
    backgroundColor: '#10B981',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  weeklyTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 12,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weeklyStat: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  weeklyLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  weeklyDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  trainingTypes: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  trainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  trainingIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  trainingIconText: {
    fontSize: 24,
  },
  trainingInfo: {
    flex: 1,
  },
  trainingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  trainingDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  trainingStats: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  trainingArrow: {
    fontSize: 24,
    color: '#D1D5DB',
  },
  skillsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  skillName: {
    width: 90,
    fontSize: 13,
    color: '#4B5563',
  },
  skillBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 10,
  },
  skillProgress: {
    height: '100%',
    borderRadius: 4,
  },
  skillValue: {
    width: 40,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
  },
  noSkillsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noSkillsIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noSkillsText: {
    color: '#9CA3AF',
  },
  recentSessions: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionIconText: {
    fontSize: 18,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  sessionDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  sessionResult: {
    alignItems: 'flex-end',
  },
  sessionRate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  sessionLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  achievementsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  achievementsIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  achievementsInfo: {
    flex: 1,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  achievementsDesc: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 2,
  },
  achievementsArrow: {
    fontSize: 24,
    color: '#D97706',
  },
  bottomPadding: {
    height: 20,
  },
  hawkEyeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  hawkEyeIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  hawkEyeInfo: {
    flex: 1,
  },
  hawkEyeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  hawkEyeDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  hawkEyeArrow: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
