import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { friendsApi, User, Friendship } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

type TabType = 'friends' | 'requests' | 'search';

export default function FriendsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsApi.getList(user.id);
      setFriends(data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  }, [user?.id]);

  const fetchPendingRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsApi.getPending(user.id);
      setPendingRequests(data);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    }
  }, [user?.id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchFriends(), fetchPendingRequests()]);
    setLoading(false);
  }, [fetchFriends, fetchPendingRequests]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !user?.id) return;
    setSearching(true);
    try {
      const results = await friendsApi.searchUsers(searchQuery, user.id);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setSearching(false);
  }, [searchQuery, user?.id]);

  const handleSendRequest = async (friendId: string) => {
    if (!user?.id) return;
    try {
      await friendsApi.sendRequest(user.id, friendId);
      Alert.alert('成功', '好友请求已发送');
      // 从搜索结果中移除
      setSearchResults((prev) => prev.filter((u) => u.id !== friendId));
    } catch (error) {
      Alert.alert('错误', '发送好友请求失败');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await friendsApi.acceptRequest(friendshipId);
      Alert.alert('成功', '已添加好友');
      fetchData();
    } catch (error) {
      Alert.alert('错误', '接受好友请求失败');
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await friendsApi.remove(friendshipId);
      fetchPendingRequests();
    } catch (error) {
      Alert.alert('错误', '拒绝好友请求失败');
    }
  };

  const handleInviteMatch = (friend: User) => {
    router.push({
      pathname: '/friends/invite',
      params: { friendId: friend.id, friendName: friend.name },
    });
  };

  const renderFriend = ({ item }: { item: User }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendLevel}>
            水平 {item.level?.toFixed(1) || '3.5'} · Rating {item.rating || 1200}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.inviteButton}
        onPress={() => handleInviteMatch(item)}
      >
        <Text style={styles.inviteButtonText}>约战</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPendingRequest = ({ item }: { item: Friendship }) => (
    <View style={styles.requestCard}>
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.requester?.name || '未知用户'}</Text>
          <Text style={styles.friendLevel}>
            水平 {item.requester?.level?.toFixed(1) || '3.5'}
          </Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>接受</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectRequest(item.id)}
        >
          <Text style={styles.rejectButtonText}>拒绝</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResult = ({ item }: { item: User }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendLevel}>
            水平 {item.level?.toFixed(1) || '3.5'} · Rating {item.rating || 1200}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleSendRequest(item.id)}
      >
        <Text style={styles.addButtonText}>添加</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '我的好友',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 标签栏 */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => setActiveTab('friends')}
          >
            <Text
              style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}
            >
              好友 ({friends.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text
              style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}
            >
              请求 ({pendingRequests.length})
            </Text>
            {pendingRequests.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => setActiveTab('search')}
          >
            <Text
              style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}
            >
              搜索
            </Text>
          </TouchableOpacity>
        </View>

        {/* 搜索框 */}
        {activeTab === 'search' && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="搜索用户名或手机号"
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>搜索</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 内容区域 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <>
            {activeTab === 'friends' && (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#10B981"
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>👥</Text>
                    <Text style={styles.emptyText}>还没有好友</Text>
                    <Text style={styles.emptySubtext}>去搜索添加好友吧</Text>
                  </View>
                }
              />
            )}

            {activeTab === 'requests' && (
              <FlatList
                data={pendingRequests}
                renderItem={renderPendingRequest}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#10B981"
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📭</Text>
                    <Text style={styles.emptyText}>没有待处理的请求</Text>
                  </View>
                }
              />
            )}

            {activeTab === 'search' && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  searchQuery ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyIcon}>🔍</Text>
                      <Text style={styles.emptyText}>未找到用户</Text>
                    </View>
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyIcon}>🔍</Text>
                      <Text style={styles.emptyText}>输入用户名或手机号搜索</Text>
                    </View>
                  )
                }
              />
            )}
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontSize: 15,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1F2937',
  },
  searchButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  friendCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  friendLevel: {
    fontSize: 13,
    color: '#6B7280',
  },
  inviteButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  acceptButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rejectButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 17,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
});
