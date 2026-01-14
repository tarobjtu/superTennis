import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('提示', '请输入手机号');
      return;
    }

    if (phone.length !== 11) {
      Alert.alert('提示', '请输入正确的手机号');
      return;
    }

    setIsLoading(true);
    const success = await login(phone.trim(), name.trim() || undefined);
    setIsLoading(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('登录失败', '请检查网络连接后重试');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoIcon}>🎾</Text>
          <Text style={styles.logoText}>超级网球</Text>
          <Text style={styles.logoSubtext}>记录每一场精彩对决</Text>
        </View>

        {/* 登录表单 */}
        <View style={styles.formSection}>
          <Text style={styles.inputLabel}>手机号</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputPrefix}>+86</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入手机号"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={11}
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Text style={styles.inputLabel}>昵称 (可选)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.inputFull]}
              placeholder="给自己起个名字"
              placeholderTextColor="#9CA3AF"
              maxLength={20}
              value={name}
              onChangeText={setName}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? '登录中...' : '登录 / 注册'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            首次登录将自动创建账号
          </Text>
        </View>

        {/* 底部协议 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            登录即表示同意 <Text style={styles.footerLink}>用户协议</Text> 和 <Text style={styles.footerLink}>隐私政策</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoIcon: {
    fontSize: 72,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#6B7280',
  },
  formSection: {
    paddingHorizontal: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  inputPrefix: {
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#6B7280',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    paddingVertical: 16,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  inputFull: {
    paddingLeft: 16,
  },
  loginButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  loginButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footerText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 20,
  },
  footerLink: {
    color: '#10B981',
  },
});
