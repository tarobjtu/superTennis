import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userApi, User } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (phone: string, name?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (phone: string, name?: string) => {
        try {
          set({ isLoading: true });

          // 先尝试通过手机号查找用户
          const users = await userApi.getByPhone(phone);
          let user = users.length > 0 ? users[0] : null;

          if (!user) {
            // 用户不存在，创建新用户
            user = await userApi.create({
              name: name || `球友${phone.slice(-4)}`,
              phone,
              level: 3.5,
            });
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch (error) {
          console.error('Login failed:', error);
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      updateProfile: async (data: Partial<User>) => {
        const { user } = get();
        if (!user) return;

        try {
          const updatedUser = await userApi.update(user.id, data);
          set({ user: updatedUser });
        } catch (error) {
          console.error('Update profile failed:', error);
        }
      },

      checkAuth: async () => {
        const { user } = get();
        if (user) {
          // 验证用户是否仍然存在
          try {
            const freshUser = await userApi.getById(user.id);
            set({
              user: freshUser,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            // 用户不存在了，清除状态
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // 恢复后检查认证状态
        if (state) {
          state.checkAuth();
        }
      },
    }
  )
);
