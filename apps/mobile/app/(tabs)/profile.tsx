import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { matchApi, Match, notificationsApi } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

interface Stats {
  totalMatches: number;
  wins: number;
  winRate: string;
}

interface MenuItemProps {
  icon: string;
  title: string;
  onPress?: () => void;
  badge?: number;
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ totalMatches: 0, wins: 0, winRate: '-' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const count = await notificationsApi.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [user?.id]);

  const calculateStats = useCallback(async () => {
    try {
      const matches = await matchApi.getAll();
      const finishedMatches = matches.filter((m: Match) => m.isFinished);
      const totalMatches = finishedMatches.length;
      const wins = finishedMatches.filter((m: Match) => m.winner === 1).length;
      const winRate = totalMatches > 0 ? `${Math.round((wins / totalMatches) * 100)}%` : '-';

      setStats({ totalMatches, wins, winRate });
      await fetchUnreadCount();
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchUnreadCount]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    calculateStats();
  }, [calculateStats]);

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {/* 用户信息卡片 */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>👤</Text>
          </View>
          <Text style={styles.userName}>{user?.name || '网球爱好者'}</Text>
          <Text style={styles.userLevel}>
            水平 {user?.level?.toFixed(1) || '3.5'} · Rating {user?.rating || 1200}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              {loading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Text style={styles.statValue}>{stats.totalMatches}</Text>
              )}
              <Text style={styles.statLabel}>总场次</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              {loading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Text style={styles.statValue}>{stats.wins}</Text>
              )}
              <Text style={styles.statLabel}>胜场</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              {loading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Text style={styles.statValue}>{stats.winRate}</Text>
              )}
              <Text style={styles.statLabel}>胜率</Text>
            </View>
          </View>
        </View>

        {/* 菜单列表 */}
        <View style={styles.menuSection}>
          <MenuItem icon="📊" title="我的数据" onPress={() => router.push('/stats')} />
          <MenuItem icon="📹" title="比赛录像" onPress={() => router.push('/videos')} />
          <MenuItem icon="⭐" title="精彩集锦" onPress={() => router.push('/highlights')} />
          <MenuItem icon="👥" title="我的好友" onPress={() => router.push('/friends')} />
          <MenuItem
            icon="🔔"
            title="通知消息"
            onPress={() => router.push('/notifications')}
            badge={unreadCount}
          />
        </View>

        <View style={styles.menuSection}>
          <MenuItem icon="📱" title="设备管理" />
          <MenuItem icon="⚙️" title="设置" />
          <MenuItem icon="❓" title="帮助与反馈" />
        </View>

        {/* 退出登录 */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        {/* 版本信息 */}
        <Text style={styles.versionText}>超级网球 v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, title, onPress, badge }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuTitle}>{title}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Text style={styles.menuArrow}>&gt;</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    fontSize: 40,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  userLevel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  menuSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  menuArrow: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '500',
  },
  versionText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    paddingVertical: 20,
  },
});
