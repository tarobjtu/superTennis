import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { clubsApi, Club } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

interface ClubMember {
  id: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'member';
  joinedAt: string;
  matchesPlayed: number;
  winRate: number;
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'matches' | 'ranking'>('members');

  useEffect(() => {
    if (id) {
      loadClubData();
    }
  }, [id]);

  const loadClubData = async () => {
    try {
      const clubData = await clubsApi.getById(id!);
      setClub(clubData);

      // 模拟成员数据
      const mockMembers: ClubMember[] = [
        {
          id: '1',
          name: '张三',
          role: 'admin',
          joinedAt: '2024-01-15',
          matchesPlayed: 42,
          winRate: 68,
        },
        {
          id: '2',
          name: '李四',
          role: 'member',
          joinedAt: '2024-02-20',
          matchesPlayed: 28,
          winRate: 55,
        },
        {
          id: '3',
          name: '王五',
          role: 'member',
          joinedAt: '2024-03-10',
          matchesPlayed: 35,
          winRate: 62,
        },
        {
          id: '4',
          name: '赵六',
          role: 'member',
          joinedAt: '2024-03-25',
          matchesPlayed: 19,
          winRate: 47,
        },
      ];
      setMembers(mockMembers);

      // 检查用户角色
      if (user?.id) {
        const userClubs = await clubsApi.getUserClubs(user.id);
        const userClub = userClubs.find((c: any) => c.id === id);
        setIsMember(!!userClub);
        setIsAdmin(userClub?.role === 'admin');
      }

      // 生成邀请码
      setInviteCode(`CLUB${id?.slice(0, 6).toUpperCase()}`);
    } catch (error) {
      console.error('Failed to load club:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClubData();
  };

  const handleJoin = async () => {
    if (!user?.id || !id) return;
    try {
      await clubsApi.join(id, user.id);
      setIsMember(true);
      Alert.alert('加入成功', `欢迎加入 ${club?.name}！`);
      loadClubData();
    } catch (error) {
      Alert.alert('加入失败', '请稍后重试');
    }
  };

  const handleLeave = async () => {
    if (!user?.id || !id) return;

    Alert.alert('退出俱乐部', `确定要退出 ${club?.name} 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await clubsApi.leave(id, user.id);
            setIsMember(false);
            Alert.alert('已退出', '你已退出该俱乐部');
            router.back();
          } catch (error) {
            Alert.alert('操作失败', '请稍后重试');
          }
        },
      },
    ]);
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message: `邀请你加入 ${club?.name}！\n\n邀请码: ${inviteCode}\n\n下载超级网球 App，使用邀请码加入我们一起打球吧！`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!isAdmin) return;

    Alert.alert('移除成员', `确定要将 ${memberName} 移出俱乐部吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定移除',
        style: 'destructive',
        onPress: async () => {
          // TODO: API 调用
          setMembers(members.filter((m) => m.id !== memberId));
        },
      },
    ]);
  };

  const handleSetAdmin = (memberId: string, memberName: string) => {
    if (!isAdmin) return;

    Alert.alert('设为管理员', `确定要将 ${memberName} 设为管理员吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          setMembers(
            members.map((m) => (m.id === memberId ? { ...m, role: 'admin' as const } : m))
          );
        },
      },
    ]);
  };

  const renderMemberCard = ({ item }: { item: ClubMember }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onLongPress={() => {
        if (isAdmin && item.id !== user?.id) {
          Alert.alert(item.name, '选择操作', [
            { text: '取消', style: 'cancel' },
            { text: '设为管理员', onPress: () => handleSetAdmin(item.id, item.name) },
            {
              text: '移出俱乐部',
              style: 'destructive',
              onPress: () => handleRemoveMember(item.id, item.name),
            },
          ]);
        }
      }}
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>{item.avatar || item.name.charAt(0)}</Text>
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>{item.name}</Text>
          {item.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>管理员</Text>
            </View>
          )}
        </View>
        <Text style={styles.memberStats}>
          {item.matchesPlayed} 场比赛 · 胜率 {item.winRate}%
        </Text>
      </View>
      <TouchableOpacity
        style={styles.challengeButton}
        onPress={() => {
          Alert.alert('发起挑战', `向 ${item.name} 发起约球挑战？`, [
            { text: '取消', style: 'cancel' },
            { text: '发起', onPress: () => {} },
          ]);
        }}
      >
        <Text style={styles.challengeButtonText}>约球</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRankingItem = ({ item, index }: { item: ClubMember; index: number }) => (
    <View style={styles.rankingItem}>
      <View
        style={[
          styles.rankNumber,
          index === 0 && styles.rankGold,
          index === 1 && styles.rankSilver,
          index === 2 && styles.rankBronze,
        ]}
      >
        <Text style={[styles.rankNumberText, index < 3 && styles.rankNumberTextTop]}>
          {index + 1}
        </Text>
      </View>
      <View style={styles.rankAvatar}>
        <Text style={styles.rankAvatarText}>{item.avatar || item.name.charAt(0)}</Text>
      </View>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName}>{item.name}</Text>
        <Text style={styles.rankWinRate}>胜率 {item.winRate}%</Text>
      </View>
      <View style={styles.rankMatches}>
        <Text style={styles.rankMatchesNumber}>{item.matchesPlayed}</Text>
        <Text style={styles.rankMatchesLabel}>场次</Text>
      </View>
    </View>
  );

  if (loading || !club) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: club.name,
          headerRight: () =>
            isAdmin ? (
              <TouchableOpacity onPress={() => setShowInviteModal(true)}>
                <Text style={styles.inviteButton}>邀请</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* 俱乐部信息卡片 */}
          <View style={styles.headerCard}>
            <View style={styles.clubLogo}>
              <Text style={styles.clubLogoText}>{club.avatar || '🎾'}</Text>
            </View>
            <Text style={styles.clubName}>{club.name}</Text>
            {club.location && <Text style={styles.clubLocation}>📍 {club.location}</Text>}
            {club.description && <Text style={styles.clubDescription}>{club.description}</Text>}

            {/* 统计数据 */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{members.length}</Text>
                <Text style={styles.statLabel}>成员</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>156</Text>
                <Text style={styles.statLabel}>比赛</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>28</Text>
                <Text style={styles.statLabel}>本周活跃</Text>
              </View>
            </View>

            {/* 操作按钮 */}
            {!isMember ? (
              <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
                <Text style={styles.joinButtonText}>加入俱乐部</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.memberActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    // TODO: 创建俱乐部内比赛
                  }}
                >
                  <Text style={styles.actionButtonIcon}>🎾</Text>
                  <Text style={styles.actionButtonText}>发起比赛</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleShareInvite}>
                  <Text style={styles.actionButtonIcon}>📤</Text>
                  <Text style={styles.actionButtonText}>邀请好友</Text>
                </TouchableOpacity>
                {!isAdmin && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.leaveButton]}
                    onPress={handleLeave}
                  >
                    <Text style={styles.actionButtonIcon}>🚪</Text>
                    <Text style={[styles.actionButtonText, styles.leaveButtonText]}>退出</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Tab 切换 */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'members' && styles.tabActive]}
              onPress={() => setActiveTab('members')}
            >
              <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
                成员
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ranking' && styles.tabActive]}
              onPress={() => setActiveTab('ranking')}
            >
              <Text style={[styles.tabText, activeTab === 'ranking' && styles.tabTextActive]}>
                排行榜
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
              onPress={() => setActiveTab('matches')}
            >
              <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
                比赛记录
              </Text>
            </TouchableOpacity>
          </View>

          {/* 内容区域 */}
          {activeTab === 'members' && (
            <View style={styles.contentSection}>
              {members.map((member) => (
                <View key={member.id}>{renderMemberCard({ item: member })}</View>
              ))}
            </View>
          )}

          {activeTab === 'ranking' && (
            <View style={styles.contentSection}>
              {members
                .sort((a, b) => b.winRate - a.winRate)
                .map((member, index) => (
                  <View key={member.id}>{renderRankingItem({ item: member, index })}</View>
                ))}
            </View>
          )}

          {activeTab === 'matches' && (
            <View style={styles.contentSection}>
              <View style={styles.emptyMatches}>
                <Text style={styles.emptyIcon}>🎾</Text>
                <Text style={styles.emptyText}>暂无比赛记录</Text>
                <TouchableOpacity style={styles.createMatchButton}>
                  <Text style={styles.createMatchButtonText}>发起第一场比赛</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 邀请弹窗 */}
        <Modal
          visible={showInviteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInviteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>邀请成员</Text>

              <View style={styles.inviteCodeBox}>
                <Text style={styles.inviteCodeLabel}>邀请码</Text>
                <Text style={styles.inviteCode}>{inviteCode}</Text>
              </View>

              <TouchableOpacity style={styles.shareButton} onPress={handleShareInvite}>
                <Text style={styles.shareButtonText}>分享邀请</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInviteModal(false)}
              >
                <Text style={styles.closeButtonText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
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
    color: '#6B7280',
    fontSize: 16,
  },
  inviteButton: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  clubLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  clubLogoText: {
    fontSize: 40,
  },
  clubName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  clubLocation: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  clubDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  joinButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  leaveButton: {
    backgroundColor: '#FEE2E2',
  },
  leaveButtonText: {
    color: '#DC2626',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ECFDF5',
  },
  tabText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#059669',
  },
  contentSection: {
    padding: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  memberStats: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  challengeButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  challengeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  rankNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankGold: {
    backgroundColor: '#FCD34D',
  },
  rankSilver: {
    backgroundColor: '#D1D5DB',
  },
  rankBronze: {
    backgroundColor: '#FBBF24',
  },
  rankNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  rankNumberTextTop: {
    color: '#fff',
  },
  rankAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  rankWinRate: {
    fontSize: 13,
    color: '#10B981',
  },
  rankMatches: {
    alignItems: 'center',
  },
  rankMatchesNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  rankMatchesLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyMatches: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  createMatchButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  createMatchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
  },
  inviteCodeBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteCodeLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 4,
  },
  shareButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
});
