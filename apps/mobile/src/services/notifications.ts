import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { notificationsApi } from './api';

// 配置通知处理方式
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 注册推送通知
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  let token: string | null = null;

  // 检查是否是真机（推送通知只在真机上工作）
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  // 检查并请求权限
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permission');
    return null;
  }

  // 获取推送 token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // 需要替换为实际的 Expo 项目 ID
    });
    token = tokenData.data;

    // 注册到服务器
    await notificationsApi.registerPushToken(userId, token, Platform.OS);

    console.log('Push token registered:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  // Android 需要设置通知频道
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
  }

  return token;
}

// 发送本地通知
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // 立即发送
  });
}

// 发送比赛提醒通知
export async function scheduleMatchReminder(
  matchId: string,
  matchTime: Date,
  opponentName: string,
  location?: string
) {
  // 提前30分钟提醒
  const reminderTime = new Date(matchTime.getTime() - 30 * 60 * 1000);

  if (reminderTime <= new Date()) {
    console.log('Match reminder time has already passed');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '比赛提醒',
      body: `30分钟后与 ${opponentName} 的比赛即将开始${location ? `，地点：${location}` : ''}`,
      data: { matchId, type: 'match_reminder' },
      sound: true,
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminderTime },
  });

  console.log('Match reminder scheduled for:', reminderTime);
}

// 取消所有通知
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// 取消特定通知
export async function cancelNotification(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// 获取所有已排程的通知
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

// 设置角标数量
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

// 清除角标
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

// 添加通知点击监听器
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// 添加通知接收监听器
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}
