import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { leaderboardApi } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

interface MatchedPlayer {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  winRate: number;
  matchesPlayed: number;
  distance?: string;
}

export default function MatchmakingScreen() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'confirmed'>('idle');
  const [matchedPlayer, setMatchedPlayer] = useState<MatchedPlayer | null>(null);
  const [searchTime, setSearchTime] = useState(0);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startMatching = async () => {
    setStatus('searching');
    setSearchTime(0);

    // 开始搜索动画
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // 搜索计时
    timerRef.current = setInterval(() => {
      setSearchTime(t => t + 1);
    }, 1000);

    // 模拟匹配过程
    try {
      // const result = await leaderboardApi.findMatch(user?.id);
      setTimeout(() => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        rotateAnim.stopAnimation();

        // 模拟匹配结果
        setMatchedPlayer({
          id: 'mock-player',
          name: '李明',
          rating: 1520,
          winRate: 62,
          matchesPlayed: 45,
          distance: '3.2km',
        });
        setStatus('found');

        // 显示动画
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 3000 + Math.random() * 2000);
    } catch (error) {
      console.error('Matchmaking failed:', error);
      setStatus('idle');
    }
  };

  const cancelMatching = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    rotateAnim.stopAnimation();
    rotateAnim.setValue(0);
    setStatus('idle');
  };

  const confirmMatch = () => {
    setStatus('confirmed');
    Alert.alert(
      '匹配成功！',
      `你已和 ${matchedPlayer?.name} 配对成功，对方会收到你的比赛邀请`,
      [
        {
          text: '创建比赛',
          onPress: () => {
            router.replace('/match/setup');
          },
        },
        {
          text: '返回',
          style: 'cancel',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const declineMatch = () => {
    scaleAnim.setValue(0);
    setMatchedPlayer(null);
    setStatus('idle');
  };

  const formatSearchTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // 用户自己的信息（模拟）
  const myRating = 1485;
  const myWinRate = 58;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '匹配对手',
          presentation: 'modal',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 我的信息 */}
        <View style={styles.myInfoCard}>
          <View style={styles.myAvatar}>
            <Text style={styles.myAvatarText}>👤</Text>
          </View>
          <View style={styles.myInfo}>
            <Text style={styles.myName}>{user?.name || '我'}</Text>
            <View style={styles.myStats}>
              <View style={styles.myStat}>
                <Text style={styles.myStatValue}>{myRating}</Text>
                <Text style={styles.myStatLabel}>积分</Text>
              </View>
              <View style={styles.myStatDivider} />
              <View style={styles.myStat}>
                <Text style={styles.myStatValue}>{myWinRate}%</Text>
                <Text style={styles.myStatLabel}>胜率</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 匹配区域 */}
        <View style={styles.matchArea}>
          {status === 'idle' && (
            <View style={styles.idleState}>
              <View style={styles.matchCircle}>
                <Text style={styles.matchIcon}>🎾</Text>
              </View>
              <Text style={styles.matchTitle}>寻找水平相近的对手</Text>
              <Text style={styles.matchSubtitle}>
                系统将根据你的积分匹配合适的球友
              </Text>

              <View style={styles.matchRangeInfo}>
                <Text style={styles.matchRangeLabel}>匹配范围</Text>
                <Text style={styles.matchRangeValue}>
                  积分 {myRating - 100} ~ {myRating + 100}
                </Text>
              </View>
            </View>
          )}

          {status === 'searching' && (
            <View style={styles.searchingState}>
              <Animated.View
                style={[
                  styles.searchCircle,
                  { transform: [{ rotate: spin }] },
                ]}
              >
                <View style={styles.searchInner}>
                  <Text style={styles.searchIcon}>🔍</Text>
                </View>
              </Animated.View>
              <Text style={styles.searchingText}>正在寻找对手...</Text>
              <Text style={styles.searchTime}>{formatSearchTime(searchTime)}</Text>

              <View style={styles.searchTips}>
                <Text style={styles.searchTip}>💡 匹配范围会随时间逐渐扩大</Text>
              </View>
            </View>
          )}

          {status === 'found' && matchedPlayer && (
            <Animated.View
              style={[
                styles.foundState,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Text style={styles.foundTitle}>🎉 找到对手！</Text>

              <View style={styles.matchedCard}>
                <View style={styles.matchedAvatar}>
                  <Text style={styles.matchedAvatarText}>
                    {matchedPlayer.avatar || matchedPlayer.name.charAt(0)}
                  </Text>
                </View>
                <Text style={styles.matchedName}>{matchedPlayer.name}</Text>
                {matchedPlayer.distance && (
                  <Text style={styles.matchedDistance}>📍 {matchedPlayer.distance}</Text>
                )}

                <View style={styles.matchedStats}>
                  <View style={styles.matchedStat}>
                    <Text style={styles.matchedStatValue}>{matchedPlayer.rating}</Text>
                    <Text style={styles.matchedStatLabel}>积分</Text>
                  </View>
                  <View style={styles.matchedStatDivider} />
                  <View style={styles.matchedStat}>
                    <Text style={styles.matchedStatValue}>{matchedPlayer.winRate}%</Text>
                    <Text style={styles.matchedStatLabel}>胜率</Text>
                  </View>
                  <View style={styles.matchedStatDivider} />
                  <View style={styles.matchedStat}>
                    <Text style={styles.matchedStatValue}>{matchedPlayer.matchesPlayed}</Text>
                    <Text style={styles.matchedStatLabel}>场次</Text>
                  </View>
                </View>

                <View style={styles.ratingComparison}>
                  <Text style={styles.comparisonText}>
                    积分差距: {Math.abs(matchedPlayer.rating - myRating)} 分
                    {matchedPlayer.rating > myRating ? ' (对手略强)' : ' (你略强)'}
                  </Text>
                </View>
              </View>

              <View style={styles.foundActions}>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={declineMatch}
                >
                  <Text style={styles.declineButtonText}>换一个</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={confirmMatch}
                >
                  <Text style={styles.confirmButtonText}>开始约球</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>

        {/* 底部按钮 */}
        <View style={styles.bottomBar}>
          {status === 'idle' && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={startMatching}
            >
              <Text style={styles.startButtonText}>开始匹配</Text>
            </TouchableOpacity>
          )}

          {status === 'searching' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelMatching}
            >
              <Text style={styles.cancelButtonText}>取消匹配</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  myInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  myAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  myAvatarText: {
    fontSize: 28,
  },
  myInfo: {
    flex: 1,
  },
  myName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  myStats: {
    flexDirection: 'row',
  },
  myStat: {
    marginRight: 20,
  },
  myStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  myStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  myStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#374151',
    marginRight: 20,
  },
  matchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  idleState: {
    alignItems: 'center',
  },
  matchCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1F2937',
    borderWidth: 3,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  matchIcon: {
    fontSize: 48,
  },
  matchTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  matchRangeInfo: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  matchRangeLabel: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  matchRangeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    textAlign: 'center',
    marginTop: 4,
  },
  searchingState: {
    alignItems: 'center',
  },
  searchCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  searchInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    fontSize: 40,
  },
  searchingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  searchTime: {
    fontSize: 32,
    fontWeight: '300',
    color: '#10B981',
    fontVariant: ['tabular-nums'],
    marginBottom: 24,
  },
  searchTips: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchTip: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  foundState: {
    alignItems: 'center',
    width: '100%',
  },
  foundTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
  },
  matchedCard: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  matchedAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchedAvatarText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '600',
  },
  matchedName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  matchedDistance: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  matchedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchedStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  matchedStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  matchedStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  matchedStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#374151',
  },
  ratingComparison: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  comparisonText: {
    fontSize: 13,
    color: '#10B981',
  },
  foundActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    padding: 20,
  },
  startButton: {
    backgroundColor: '#10B981',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#374151',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '600',
  },
});
