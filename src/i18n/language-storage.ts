import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLocale, SUPPORTED_LOCALES } from './locales';

const LANGUAGE_KEY = '@splitwiser_language';
const LANGUAGE_MODE_KEY = '@splitwiser_language_mode';

export interface StoredLanguagePreference {
  locale: SupportedLocale | null;
  mode: 'system' | 'manual';
}

export async function getStoredLanguagePreference(): Promise<StoredLanguagePreference> {
  try {
    const [storedLocale, storedMode] = await Promise.all([
      AsyncStorage.getItem(LANGUAGE_KEY),
      AsyncStorage.getItem(LANGUAGE_MODE_KEY),
    ]);

    const mode: 'system' | 'manual' = storedMode === 'manual' ? 'manual' : 'system';

    if (storedLocale && SUPPORTED_LOCALES.includes(storedLocale as SupportedLocale)) {
      return {
        locale: storedLocale as SupportedLocale,
        mode,
      };
    }

    return {
      locale: null,
      mode: 'system',
    };
  } catch (error) {
    console.warn('Failed to read language preference from storage:', error);
    return {
      locale: null,
      mode: 'system',
    };
  }
}

export async function saveLanguagePreference(
  locale: SupportedLocale | null,
  mode: 'system' | 'manual'
): Promise<void> {
  try {
    if (mode === 'system' || !locale) {
      await Promise.all([
        AsyncStorage.removeItem(LANGUAGE_KEY),
        AsyncStorage.setItem(LANGUAGE_MODE_KEY, 'system'),
      ]);
    } else {
      await Promise.all([
        AsyncStorage.setItem(LANGUAGE_KEY, locale),
        AsyncStorage.setItem(LANGUAGE_MODE_KEY, 'manual'),
      ]);
    }
  } catch (error) {
    console.warn('Failed to save language preference to storage:', error);
  }
}

export async function clearLanguagePreference(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(LANGUAGE_KEY),
      AsyncStorage.removeItem(LANGUAGE_MODE_KEY),
    ]);
  } catch (error) {
    console.warn('Failed to clear language preference:', error);
  }
}

