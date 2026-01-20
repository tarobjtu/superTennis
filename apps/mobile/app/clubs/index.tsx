import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { clubsApi, Club } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

export default function ClubsScreen() {
  const { user } = useAuthStore();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'discover' | 'my'>('discover');

  const loadData = async () => {
    try {
      const [allClubs, userClubs] = await Promise.all([
        clubsApi.getAll(search || undefined),
        user?.id ? clubsApi.getUserClubs(user.id) : Promise.resolve([]),
      ]);
      setClubs(allClubs);
      setMyClubs(userClubs);
    } catch (error) {
      console.error('Failed to load clubs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleJoin = async (clubId: string) => {
    if (!user?.id) return;
    try {
      await clubsApi.join(clubId, user.id);
      loadData();
    } catch (error) {
      console.error('Failed to join club:', error);
    }
  };

  const renderClubCard = ({ item }: { item: Club }) => {
    const isMember = myClubs.some((c) => c.id === item.id);

    return (
      <TouchableOpacity style={styles.clubCard} onPress={() => router.push(`/clubs/${item.id}`)}>
        <View style={styles.clubAvatar}>
          <Text style={styles.clubAvatarText}>{item.avatar || '🎾'}</Text>
        </View>
        <View style={styles.clubInfo}>
          <Text style={styles.clubName}>{item.name}</Text>
          {item.location && <Text style={styles.clubLocation}>📍 {item.location}</Text>}
          <Text style={styles.clubMembers}>{item.memberCount} 位成员</Text>
        </View>
        {!isMember && (
          <TouchableOpacity style={styles.joinButton} onPress={() => handleJoin(item.id)}>
            <Text style={styles.joinButtonText}>加入</Text>
          </TouchableOpacity>
        )}
        {isMember && (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>已加入</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMyClubCard = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.clubCard} onPress={() => router.push(`/clubs/${item.id}`)}>
      <View style={styles.clubAvatar}>
        <Text style={styles.clubAvatarText}>{item.avatar || '🎾'}</Text>
      </View>
      <View style={styles.clubInfo}>
        <View style={styles.clubNameRow}>
          <Text style={styles.clubName}>{item.name}</Text>
          {item.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>管理员</Text>
            </View>
          )}
        </View>
        {item.location && <Text style={styles.clubLocation}>📍 {item.location}</Text>}
        <Text style={styles.clubMembers}>{item.memberCount} 位成员</Text>
      </View>
      <Text style={styles.arrowIcon}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>加载俱乐部...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '俱乐部',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/clubs/create')}>
              <Text style={styles.createButton}>创建</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 搜索栏 */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="搜索俱乐部"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'discover' && styles.tabActive]}
            onPress={() => setTab('discover')}
          >
            <Text style={[styles.tabText, tab === 'discover' && styles.tabTextActive]}>
              发现俱乐部
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'my' && styles.tabActive]}
            onPress={() => setTab('my')}
          >
            <Text style={[styles.tabText, tab === 'my' && styles.tabTextActive]}>
              我的俱乐部 ({myClubs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 俱乐部列表 */}
        <FlatList
          data={tab === 'discover' ? clubs : myClubs}
          renderItem={tab === 'discover' ? renderClubCard : renderMyClubCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyText}>
                {tab === 'discover' ? '暂无俱乐部' : '你还没有加入任何俱乐部'}
              </Text>
              {tab === 'my' && (
                <TouchableOpacity style={styles.emptyButton} onPress={() => setTab('discover')}>
                  <Text style={styles.emptyButtonText}>发现俱乐部</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
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
    marginTop: 12,
    color: '#6B7280',
  },
  createButton: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 16,
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#1F2937',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  tabActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  clubAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  clubAvatarText: {
    fontSize: 28,
  },
  clubInfo: {
    flex: 1,
  },
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubName: {
    fontSize: 17,
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
  clubLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  clubMembers: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  joinButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  memberBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  memberBadgeText: {
    color: '#059669',
    fontWeight: '500',
    fontSize: 13,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#D1D5DB',
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
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
