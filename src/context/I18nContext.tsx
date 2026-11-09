import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { I18nManager, Alert } from 'react-native';
import i18n, {
  SupportedLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isRtlLocale,
  resolveInitialLocale,
  saveLanguagePreference,
  formatLocalizedAmount,
  formatLocalizedDate,
  formatLocalizedNumber,
  getDeviceLocale,
} from '../i18n';
import { syncLanguageToFirestore, fetchLanguageFromFirestore } from '../services/languageService';

interface I18nContextValue {
  currentLocale: SupportedLocale;
  isRTL: boolean;
  isSystemLanguage: boolean;
  changeLanguage: (locale: SupportedLocale | null, uid?: string) => Promise<void>;
  formatAmount: (amount: number, currencyCode?: string) => string;
  formatDate: (date: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  syncUserLanguageOnLogin: (uid: string) => Promise<void>;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [isSystemLanguage, setIsSystemLanguage] = useState(true);

  // Initialize language on app startup
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const { locale, mode } = await resolveInitialLocale();
        if (isMounted) {
          setCurrentLocale(locale);
          setIsSystemLanguage(mode === 'system');
          if (i18n.language !== locale) {
            await i18n.changeLanguage(locale);
          }

          // Handle RTL check on init
          const rtl = isRtlLocale(locale);
          if (I18nManager.isRTL !== rtl) {
            I18nManager.allowRTL(rtl);
            I18nManager.forceRTL(rtl);
          }
        }
      } catch (err) {
        console.warn('[I18nProvider] Failed to initialize locale:', err);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const changeLanguage = useCallback(
    async (locale: SupportedLocale | null, uid?: string) => {
      try {
        if (locale === null) {
          // Switch back to device/system default
          const deviceLocale = getDeviceLocale();
          await saveLanguagePreference(null, 'system');
          setIsSystemLanguage(true);
          setCurrentLocale(deviceLocale);
          await i18n.changeLanguage(deviceLocale);

          const rtl = isRtlLocale(deviceLocale);
          if (I18nManager.isRTL !== rtl) {
            I18nManager.allowRTL(rtl);
            I18nManager.forceRTL(rtl);
            Alert.alert(
              i18n.t('settings.languageChanged', { ns: 'settings', defaultValue: 'Language changed' }),
              'Please restart the app to apply text direction changes correctly.',
              [{ text: i18n.t('common.ok', { ns: 'common', defaultValue: 'OK' }) }]
            );
          }

          if (uid) {
            await syncLanguageToFirestore(uid, null);
          }
        } else if (SUPPORTED_LOCALES.includes(locale)) {
          // Explicit manual language choice
          await saveLanguagePreference(locale, 'manual');
          setIsSystemLanguage(false);
          setCurrentLocale(locale);
          await i18n.changeLanguage(locale);

          const rtl = isRtlLocale(locale);
          if (I18nManager.isRTL !== rtl) {
            I18nManager.allowRTL(rtl);
            I18nManager.forceRTL(rtl);
            Alert.alert(
              i18n.t('settings.languageChanged', { ns: 'settings', defaultValue: 'Language changed' }),
              'Please restart the app to apply text direction changes correctly.',
              [{ text: i18n.t('common.ok', { ns: 'common', defaultValue: 'OK' }) }]
            );
          }

          if (uid) {
            await syncLanguageToFirestore(uid, locale);
          }
        }
      } catch (error) {
        console.error('[I18nProvider] Failed to change language:', error);
      }
    },
    []
  );

  const syncUserLanguageOnLogin = useCallback(
    async (uid: string) => {
      if (!uid) return;
      try {
        // If the user already has a manual preference in Firestore, apply it
        const remoteLocale = await fetchLanguageFromFirestore(uid);
        if (remoteLocale && SUPPORTED_LOCALES.includes(remoteLocale)) {
          await saveLanguagePreference(remoteLocale, 'manual');
          setIsSystemLanguage(false);
          setCurrentLocale(remoteLocale);
          await i18n.changeLanguage(remoteLocale);
        }
      } catch (error) {
        console.warn('[I18nProvider] Failed to sync user language on login:', error);
      }
    },
    []
  );

  const formatAmount = useCallback(
    (amount: number, currencyCode: string = 'USD') => {
      return formatLocalizedAmount(amount, currencyCode, currentLocale);
    },
    [currentLocale]
  );

  const formatDate = useCallback(
    (date: Date | number, options?: Intl.DateTimeFormatOptions) => {
      return formatLocalizedDate(date, currentLocale, options);
    },
    [currentLocale]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return formatLocalizedNumber(value, currentLocale, options);
    },
    [currentLocale]
  );

  const isRTL = isRtlLocale(currentLocale);

  const value: I18nContextValue = {
    currentLocale,
    isRTL,
    isSystemLanguage,
    changeLanguage,
    formatAmount,
    formatDate,
    formatNumber,
    syncUserLanguageOnLogin,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

