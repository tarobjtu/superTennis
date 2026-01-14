/**
 * 国际化 (i18n) 模块
 * 支持中英文切换
 */

import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import zh from './locales/zh';
import en from './locales/en';

// 支持的语言
export type Locale = 'zh' | 'en';

// 语言包类型
export type Translations = typeof zh;

// 语言包映射
const translations: Record<Locale, Translations> = {
  zh,
  en,
};

// 获取设备默认语言
function getDeviceLocale(): Locale {
  const locales = getLocales();
  const deviceLanguage = locales[0]?.languageCode;

  if (deviceLanguage === 'zh') {
    return 'zh';
  }
  return 'en';
}

// i18n Store
interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: getDeviceLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'i18n-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * 获取当前语言的翻译
 */
export function useTranslation() {
  const { locale, setLocale } = useI18nStore();
  const t = translations[locale];

  return {
    t,
    locale,
    setLocale,
    isZh: locale === 'zh',
    isEn: locale === 'en',
  };
}

/**
 * 格式化带参数的翻译
 * 例如: formatMessage('Hello {{name}}', { name: 'World' }) => 'Hello World'
 */
export function formatMessage(
  template: string,
  params: Record<string, string | number>
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), String(value)),
    template
  );
}

/**
 * 获取翻译文本（非 Hook 版本，用于非组件场景）
 */
export function getTranslations(locale?: Locale): Translations {
  const currentLocale = locale || useI18nStore.getState().locale;
  return translations[currentLocale];
}

/**
 * 语言名称映射
 */
export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

export default {
  useTranslation,
  useI18nStore,
  formatMessage,
  getTranslations,
  localeNames,
};
