import { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

// 防止 splash screen 自动隐藏
SplashScreen.preventAutoHideAsync();

function useProtectedRoute(isAuthenticated: boolean, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    // 使用 setTimeout 确保在导航准备好后再跳转
    const timer = setTimeout(() => {
      if (!isAuthenticated && !inAuthGroup) {
        // 未登录且不在登录页，跳转到登录页
        router.replace('/login');
      } else if (isAuthenticated && inAuthGroup) {
        // 已登录但在登录页，跳转到首页
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, segments]);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [appIsReady, setAppIsReady] = useState(false);

  useProtectedRoute(isAuthenticated, isLoading);

  const onLayoutRootView = useCallback(async () => {
    if (!isLoading) {
      setAppIsReady(true);
      await SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="match/setup"
            options={{
              headerShown: true,
              title: '新建比赛',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="match/calibration"
            options={{
              headerShown: true,
              title: '球场校准',
            }}
          />
          <Stack.Screen
            name="match/playing"
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="match/replay"
            options={{
              headerShown: true,
              title: '争议回放',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="match/result"
            options={{
              headerShown: true,
              title: '比赛结束',
            }}
          />
        </Stack>
      </AuthProvider>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});
