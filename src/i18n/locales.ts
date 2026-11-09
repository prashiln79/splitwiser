export const SUPPORTED_LOCALES = [
  'en',
  'zh-Hans',
  'es',
  'ar',
  'fr',
  'pt-BR',
  'id',
  'ru',
] as const;

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const RTL_LOCALES: readonly SupportedLocale[] = ['ar'] as const;

export const isRtlLocale = (locale: string): boolean => {
  return RTL_LOCALES.includes(locale as SupportedLocale);
};

export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-Hans': 'Simplified Chinese',
  es: 'Spanish',
  ar: 'Arabic',
  fr: 'French',
  'pt-BR': 'Portuguese (Brazil)',
  id: 'Indonesian',
  ru: 'Russian',
};

export const LOCALE_NATIVE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-Hans': '简体中文',
  es: 'Español',
  ar: 'العربية',
  fr: 'Français',
  'pt-BR': 'Português (Brasil)',
  id: 'Bahasa Indonesia',
  ru: 'Русский',
};

export const NAMESPACES = [
  'common',
  'auth',
  'home',
  'groups',
  'friends',
  'expenses',
  'split',
  'balances',
  'settlements',
  'charts',
  'categories',
  'settings',
  'notifications',
  'validation',
  'errors',
] as const;

export type Namespace = typeof NAMESPACES[number];

