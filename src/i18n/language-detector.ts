import * as Localization from 'expo-localization';
import { DEFAULT_LOCALE, SupportedLocale } from './locales';
import { detectBestLocale } from './locale-utils';
import { getStoredLanguagePreference } from './language-storage';

/**
 * Gets the device's system language preference mapped to our supported locales.
 */
export function getDeviceLocale(): SupportedLocale {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const candidates = locales.flatMap((l) => [l.languageTag, l.languageCode]);
      return detectBestLocale(candidates);
    }
  } catch (err) {
    console.warn('Failed to detect device locale via expo-localization:', err);
  }
  return DEFAULT_LOCALE;
}

/**
 * Resolves the active locale based on stored user preference or device locale.
 */
export async function resolveInitialLocale(): Promise<{
  locale: SupportedLocale;
  mode: 'system' | 'manual';
}> {
  const stored = await getStoredLanguagePreference();
  if (stored.mode === 'manual' && stored.locale) {
    return {
      locale: stored.locale,
      mode: 'manual',
    };
  }

  const deviceLocale = getDeviceLocale();
  return {
    locale: deviceLocale,
    mode: 'system',
  };
}

