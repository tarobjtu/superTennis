import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { trainingApi } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrainingSession {
  id: string;
  type: string;
  duration: number;
  totalShots: number;
  successfulShots: number;
  createdAt: string;
}

interface WeeklyStats {
  day: string;
  sessions: number;
  duration: number;
}

const TRAINING_TYPES: { [key: string]: { name: string; icon: string; color: string } } = {
  serve: { name: '发球练习', icon: '🎾', color: '#EF4444' },
  forehand: { name: '正手击球', icon: '💪', color: '#F59E0B' },
  backhand: { name: '反手击球', icon: '🏃', color: '#10B981' },
  volley: { name: '网前截击', icon: '⚡', color: '#3B82F6' },
  rally: { name: '底线对抗', icon: '🔄', color: '#8B5CF6' },
};

export default function TrainingHistoryScreen() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  // 模拟数据
  const mockSessions: TrainingSession[] = [
    { id: '1', type: 'serve', duration: 1800, totalShots: 120, successfulShots: 96, createdAt: '2024-12-10T10:00:00Z' },
    { id: '2', type: 'forehand', duration: 2400, totalShots: 200, successfulShots: 156, createdAt: '2024-12-09T14:30:00Z' },
    { id: '3', type: 'backhand', duration: 1500, totalShots: 90, successfulShots: 63, createdAt: '2024-12-08T09:00:00Z' },
    { id: '4', type: 'volley', duration: 1200, totalShots: 80, successfulShots: 72, createdAt: '2024-12-07T16:00:00Z' },
    { id: '5', type: 'rally', duration: 3600, totalShots: 300, successfulShots: 240, createdAt: '2024-12-06T11:00:00Z' },
    { id: '6', type: 'serve', duration: 2100, totalShots: 150, successfulShots: 127, createdAt: '2024-12-05T10:00:00Z' },
  ];

  const weeklyStats: WeeklyStats[] = [
    { day: '周一', sessions: 2, duration: 45 },
    { day: '周二', sessions: 1, duration: 30 },
    { day: '周三', sessions: 0, duration: 0 },
    { day: '周四', sessions: 3, duration: 75 },
    { day: '周五', sessions: 2, duration: 60 },
    { day: '周六', sessions: 1, duration: 40 },
    { day: '周日', sessions: 2, duration: 50 },
  ];

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    try {
      // const data = await trainingApi.getSessions(user?.id);
      setSessions(mockSessions);
    } catch (error) {
      console.error('Failed to load training data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}分钟`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}小时${remainMins}分`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 统计数据
  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalShots = sessions.reduce((sum, s) => sum + s.totalShots, 0);
  const totalSuccess = sessions.reduce((sum, s) => sum + s.successfulShots, 0);
  const avgSuccessRate = totalShots > 0 ? Math.round((totalSuccess / totalShots) * 100) : 0;
  const maxDuration = Math.max(...weeklyStats.map(s => s.duration), 1);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '训练统计',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* 时间段选择 */}
          <View style={styles.periodSelector}>
            {(['week', 'month', 'all'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === period && styles.periodButtonTextActive]}>
                  {period === 'week' ? '本周' : period === 'month' ? '本月' : '全部'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 总览统计 */}
          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>训练总览</Text>
            <View style={styles.overviewStats}>
              <View style={styles.overviewStatItem}>
                <Text style={styles.overviewStatValue}>{sessions.length}</Text>
                <Text style={styles.overviewStatLabel}>训练次数</Text>
              </View>
              <View style={styles.overviewStatDivider} />
              <View style={styles.overviewStatItem}>
                <Text style={styles.overviewStatValue}>{formatDuration(totalDuration)}</Text>
                <Text style={styles.overviewStatLabel}>总时长</Text>
              </View>
              <View style={styles.overviewStatDivider} />
              <View style={styles.overviewStatItem}>
                <Text style={[styles.overviewStatValue, { color: '#10B981' }]}>{avgSuccessRate}%</Text>
                <Text style={styles.overviewStatLabel}>成功率</Text>
              </View>
            </View>
          </View>

          {/* 周统计图表 */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>本周训练时长</Text>
            <View style={styles.chartContainer}>
              {weeklyStats.map((stat, index) => (
                <View key={index} style={styles.chartBar}>
                  <View style={styles.chartBarWrapper}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: `${(stat.duration / maxDuration) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarLabel}>{stat.day.slice(1)}</Text>
                  {stat.duration > 0 && (
                    <Text style={styles.chartBarValue}>{stat.duration}分</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* 各项目统计 */}
          <View style={styles.typeStatsCard}>
            <Text style={styles.typeStatsTitle}>项目分析</Text>
            {Object.entries(TRAINING_TYPES).map(([type, info]) => {
              const typeSessions = sessions.filter(s => s.type === type);
              const typeShots = typeSessions.reduce((sum, s) => sum + s.totalShots, 0);
              const typeSuccess = typeSessions.reduce((sum, s) => sum + s.successfulShots, 0);
              const typeRate = typeShots > 0 ? Math.round((typeSuccess / typeShots) * 100) : 0;

              return (
                <View key={type} style={styles.typeStatItem}>
                  <View style={[styles.typeIcon, { backgroundColor: info.color + '20' }]}>
                    <Text style={styles.typeIconText}>{info.icon}</Text>
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={styles.typeName}>{info.name}</Text>
                    <Text style={styles.typeCount}>{typeSessions.length} 次训练</Text>
                  </View>
                  <View style={styles.typeRate}>
                    <Text style={[styles.typeRateValue, { color: info.color }]}>{typeRate}%</Text>
                    <Text style={styles.typeRateLabel}>成功率</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* 训练历史 */}
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>训练记录</Text>
            {sessions.map((session) => {
              const typeInfo = TRAINING_TYPES[session.type] || { name: '未知', icon: '🎾', color: '#6B7280' };
              const successRate = Math.round((session.successfulShots / session.totalShots) * 100);

              return (
                <TouchableOpacity key={session.id} style={styles.historyItem}>
                  <View style={[styles.historyIcon, { backgroundColor: typeInfo.color + '20' }]}>
                    <Text style={styles.historyIconText}>{typeInfo.icon}</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyType}>{typeInfo.name}</Text>
                    <Text style={styles.historyMeta}>
                      {formatDuration(session.duration)} · {session.totalShots} 次击球
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={[styles.historyRate, { color: typeInfo.color }]}>{successRate}%</Text>
                    <Text style={styles.historyDate}>{formatDate(session.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  periodButtonActive: {
    backgroundColor: '#10B981',
  },
  periodButtonText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  overviewCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  overviewStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  overviewStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  chartCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    flex: 1,
    width: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  chartBarLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  chartBarValue: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
  },
  typeStatsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  typeStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  typeStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  typeIconText: {
    fontSize: 22,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  typeCount: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  typeRate: {
    alignItems: 'flex-end',
  },
  typeRateValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  typeRateLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  historySection: {
    marginHorizontal: 16,
    marginBottom: 30,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  historyIconText: {
    fontSize: 22,
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  historyMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyRate: {
    fontSize: 17,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
