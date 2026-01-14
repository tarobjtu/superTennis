import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { videosApi, Highlight } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HighlightsScreen() {
  const { user } = useAuthStore();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHighlights = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await videosApi.getHighlights(user.id);
      setHighlights(data);
    } catch (error) {
      console.error('Failed to fetch highlights:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHighlights();
  }, [fetchHighlights]);

  const handleDeleteHighlight = async (id: string) => {
    Alert.alert('删除精彩片段', '确定要删除这个精彩片段吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await videosApi.deleteHighlight(id);
            setHighlights((prev) => prev.filter((h) => h.id !== id));
          } catch (error) {
            Alert.alert('错误', '删除失败');
          }
        },
      },
    ]);
  };

  const formatDuration = (startTime: number, endTime: number) => {
    const duration = Math.round((endTime - startTime) / 1000);
    return `${duration}秒`;
  };

  const getHighlightTypeLabel = (type: string) => {
    switch (type) {
      case 'ace':
        return 'ACE球';
      case 'winner':
        return '制胜分';
      case 'rally':
        return '精彩回合';
      case 'dispute':
        return '争议球';
      default:
        return '精彩片段';
    }
  };

  const getHighlightTypeColor = (type: string) => {
    switch (type) {
      case 'ace':
        return '#10B981';
      case 'winner':
        return '#3B82F6';
      case 'rally':
        return '#8B5CF6';
      case 'dispute':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const renderHighlight = ({ item }: { item: Highlight }) => (
    <TouchableOpacity
      style={styles.highlightCard}
      onPress={() => router.push(`/highlights/${item.id}`)}
      onLongPress={() => handleDeleteHighlight(item.id)}
    >
      <View style={styles.thumbnail}>
        {item.thumbnailPath ? (
          <Image source={{ uri: item.thumbnailPath }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailIcon}>⭐</Text>
          </View>
        )}
        <View style={[styles.typeBadge, { backgroundColor: getHighlightTypeColor(item.type) }]}>
          <Text style={styles.typeText}>{getHighlightTypeLabel(item.type)}</Text>
        </View>
      </View>
      <View style={styles.highlightInfo}>
        <Text style={styles.highlightTitle} numberOfLines={1}>
          {item.title || getHighlightTypeLabel(item.type)}
        </Text>
        <Text style={styles.highlightDuration}>
          {formatDuration(item.startTime, item.endTime)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '精彩集锦' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={highlights}
            renderItem={renderHighlight}
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
                <Text style={styles.emptyIcon}>⭐</Text>
                <Text style={styles.emptyText}>暂无精彩集锦</Text>
                <Text style={styles.emptySubtext}>在比赛回放中标记精彩瞬间</Text>
              </View>
            }
          />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  highlightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: '#1F2937',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: {
    fontSize: 48,
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  highlightInfo: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  highlightDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
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
