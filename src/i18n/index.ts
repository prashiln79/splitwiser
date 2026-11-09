import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { i18nConfig } from './config';
import { DEFAULT_LOCALE, SupportedLocale, SUPPORTED_LOCALES, isRtlLocale, LOCALE_DISPLAY_NAMES, LOCALE_NATIVE_NAMES } from './locales';
import { normalizeLocale, detectBestLocale, formatLocalizedAmount, formatLocalizedDate, formatLocalizedNumber } from './locale-utils';
import { getStoredLanguagePreference, saveLanguagePreference, clearLanguagePreference } from './language-storage';
import { getDeviceLocale, resolveInitialLocale } from './language-detector';

// Safe Polyfill for Hermes Intl.PluralRules if not present
if (typeof Intl === 'undefined' || !Intl.PluralRules) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@formatjs/intl-pluralrules/polyfill');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@formatjs/intl-pluralrules/locale-data/ar');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@formatjs/intl-pluralrules/locale-data/ru');
  } catch {
    // Hermes built-in Intl is present in newer RN
  }
}

// Initialize i18next instance
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    ...i18nConfig,
    lng: DEFAULT_LOCALE,
  });
}

export default i18n;

export {
  SupportedLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isRtlLocale,
  LOCALE_DISPLAY_NAMES,
  LOCALE_NATIVE_NAMES,
  normalizeLocale,
  detectBestLocale,
  formatLocalizedAmount,
  formatLocalizedDate,
  formatLocalizedNumber,
  getStoredLanguagePreference,
  saveLanguagePreference,
  clearLanguagePreference,
  getDeviceLocale,
  resolveInitialLocale,
};

