import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { leaderboardApi, LeaderboardEntry } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

export default function LeaderboardScreen() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [userRank, setUserRank] = useState<{ rank: number; total: number; percentile: number } | null>(null);

  const loadLeaderboard = async () => {
    try {
      const data = await leaderboardApi.getLeaderboard(50);
      setLeaderboard(data);

      if (user?.id) {
        const rank = await leaderboardApi.getUserRank(user.id);
        setUserRank(rank);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return styles.rankGold;
      case 2:
        return styles.rankSilver;
      case 3:
        return styles.rankBronze;
      default:
        return null;
    }
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.id === user?.id;
    const rankIcon = getRankIcon(item.rank);

    return (
      <TouchableOpacity
        style={[styles.playerCard, isMe && styles.playerCardMe]}
        onPress={() => router.push(`/profile/${item.id}`)}
      >
        <View style={[styles.rankContainer, getRankStyle(item.rank)]}>
          {rankIcon ? (
            <Text style={styles.rankIcon}>{rankIcon}</Text>
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>

        <View style={styles.avatarContainer}>
          <Text style={styles.avatar}>
            {item.avatar || '👤'}
          </Text>
        </View>

        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
            {item.name} {isMe && '(我)'}
          </Text>
          <Text style={styles.playerLevel}>水平 {item.level.toFixed(1)}</Text>
        </View>

        <View style={styles.ratingContainer}>
          <Text style={styles.ratingValue}>{item.rating}</Text>
          <Text style={styles.ratingLabel}>积分</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>加载排行榜...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.title}>排行榜</Text>
        <TouchableOpacity
          style={styles.matchButton}
          onPress={() => router.push('/leaderboard/matchmaking')}
        >
          <Text style={styles.matchButtonText}>匹配对手</Text>
        </TouchableOpacity>
      </View>

      {/* 我的排名 */}
      {userRank && (
        <View style={styles.myRankCard}>
          <View style={styles.myRankItem}>
            <Text style={styles.myRankValue}>#{userRank.rank}</Text>
            <Text style={styles.myRankLabel}>我的排名</Text>
          </View>
          <View style={styles.myRankDivider} />
          <View style={styles.myRankItem}>
            <Text style={styles.myRankValue}>{userRank.percentile}%</Text>
            <Text style={styles.myRankLabel}>超越玩家</Text>
          </View>
          <View style={styles.myRankDivider} />
          <View style={styles.myRankItem}>
            <Text style={styles.myRankValue}>{user?.rating || 1200}</Text>
            <Text style={styles.myRankLabel}>当前积分</Text>
          </View>
        </View>
      )}

      {/* 时间筛选 */}
      <View style={styles.periodTabs}>
        {(['all', 'week', 'month'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodTab, period === p && styles.periodTabActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
              {p === 'all' ? '总榜' : p === 'week' ? '周榜' : '月榜'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 排行榜列表 */}
      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyText}>暂无排名数据</Text>
          </View>
        }
      />
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
  matchButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  matchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  myRankCard: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  myRankItem: {
    flex: 1,
    alignItems: 'center',
  },
  myRankValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  myRankLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  myRankDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  periodTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  periodTabActive: {
    backgroundColor: '#10B981',
  },
  periodTabText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  periodTabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  playerCardMe: {
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankGold: {
    backgroundColor: '#FEF3C7',
  },
  rankSilver: {
    backgroundColor: '#E5E7EB',
  },
  rankBronze: {
    backgroundColor: '#FED7AA',
  },
  rankIcon: {
    fontSize: 18,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: {
    fontSize: 24,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  playerNameMe: {
    color: '#059669',
  },
  playerLevel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  ratingLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
