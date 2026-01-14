import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ClubScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 我的俱乐部 - 空状态 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>我的俱乐部</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>还没有加入俱乐部</Text>
            <Text style={styles.emptySubtitle}>加入俱乐部，与球友一起打球</Text>
            <TouchableOpacity style={styles.joinButton}>
              <Text style={styles.joinButtonText}>探索俱乐部</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 发现俱乐部 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>发现俱乐部</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>查看更多 &gt;</Text>
            </TouchableOpacity>
          </View>

          {/* 推荐俱乐部卡片 */}
          <View style={styles.clubCard}>
            <View style={styles.clubInfo}>
              <Text style={styles.clubIcon}>🎾</Text>
              <View style={styles.clubDetails}>
                <Text style={styles.clubName}>阳光网球俱乐部</Text>
                <Text style={styles.clubMeta}>⭐ 4.8 · 326人</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.joinSmallButton}>
              <Text style={styles.joinSmallButtonText}>加入</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.clubCard}>
            <View style={styles.clubInfo}>
              <Text style={styles.clubIcon}>🏸</Text>
              <View style={styles.clubDetails}>
                <Text style={styles.clubName}>CBD 网球联盟</Text>
                <Text style={styles.clubMeta}>⭐ 4.6 · 198人</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.joinSmallButton}>
              <Text style={styles.joinSmallButtonText}>加入</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 约球大厅预告 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>约球大厅</Text>
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonIcon}>🚀</Text>
            <Text style={styles.comingSoonText}>即将上线</Text>
            <Text style={styles.comingSoonSubtext}>发布约球，找到你的对手</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  section: {
    padding: 20,
    paddingBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  sectionLink: {
    fontSize: 14,
    color: '#10B981',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  joinButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  clubCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clubIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  clubDetails: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  clubMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  joinSmallButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinSmallButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  comingSoonCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  comingSoonIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  comingSoonSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
