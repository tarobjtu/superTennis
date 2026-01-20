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
import { videosApi, MatchVideo } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_WIDTH = (SCREEN_WIDTH - 48) / 2;

export default function VideosScreen() {
  const { user } = useAuthStore();
  const [videos, setVideos] = useState<MatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVideos = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await videosApi.getByUser(user.id);
      setVideos(data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVideos();
  }, [fetchVideos]);

  const handleDeleteVideo = async (id: string) => {
    Alert.alert('删除视频', '确定要删除这个视频吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await videosApi.delete(id);
            setVideos((prev) => prev.filter((v) => v.id !== id));
          } catch (error) {
            Alert.alert('错误', '删除失败');
          }
        },
      },
    ]);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderVideo = ({ item }: { item: MatchVideo }) => (
    <TouchableOpacity
      style={styles.videoCard}
      onPress={() => router.push(`/videos/${item.id}` as any)}
      onLongPress={() => handleDeleteVideo(item.id)}
    >
      <View style={styles.thumbnail}>
        {item.thumbnailPath ? (
          <Image source={{ uri: item.thumbnailPath }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.thumbnailIcon}>🎬</Text>
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoDate}>{formatDate(item.createdAt)}</Text>
        {item.isHighlight && (
          <View style={styles.highlightBadge}>
            <Text style={styles.highlightText}>精彩</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '比赛录像' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={videos}
            renderItem={renderVideo}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            columnWrapperStyle={styles.columnWrapper}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📹</Text>
                <Text style={styles.emptyText}>暂无录像</Text>
                <Text style={styles.emptySubtext}>比赛时开启录制即可保存</Text>
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
  columnWrapper: {
    justifyContent: 'space-between',
  },
  videoCard: {
    width: VIDEO_WIDTH,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: VIDEO_WIDTH * 0.75,
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
    fontSize: 32,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  videoInfo: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  highlightBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highlightText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '500',
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
