/**
 * 鹰眼挑战按钮组件
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
} from 'react-native';

interface HawkEyeButtonProps {
  onPress: () => void;
  disabled?: boolean;
  remainingChallenges?: number;
}

export default function HawkEyeButton({
  onPress,
  disabled = false,
  remainingChallenges = 3,
}: HawkEyeButtonProps) {
  const handlePress = () => {
    if (!disabled && remainingChallenges > 0) {
      onPress();
    }
  };

  const isAvailable = !disabled && remainingChallenges > 0;

  return (
    <TouchableOpacity
      style={[styles.button, !isAvailable && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={!isAvailable}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>👁️</Text>
      </View>
      <Text style={[styles.text, !isAvailable && styles.textDisabled]}>
        鹰眼挑战
      </Text>
      <View style={[styles.badge, remainingChallenges === 0 && styles.badgeEmpty]}>
        <Text style={styles.badgeText}>{remainingChallenges}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
    shadowColor: '#6B7280',
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
  },
  text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  textDisabled: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeEmpty: {
    backgroundColor: '#EF4444',
  },
  badgeText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
});
