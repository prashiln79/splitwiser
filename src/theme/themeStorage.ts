import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppearanceMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = '@splitwiser_appearance_mode';

/**
 * Loads the user's stored appearance mode from AsyncStorage.
 * Defaults to 'system' if no preference is stored.
 */
export async function getStoredThemeMode(): Promise<AppearanceMode> {
  try {
    const val = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch (error) {
    console.warn('[themeStorage] Failed to read stored theme mode:', error);
  }
  return 'system';
}

/**
 * Persists the user's appearance mode preference locally.
 */
export async function saveStoredThemeMode(mode: AppearanceMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('[themeStorage] Failed to save theme mode:', error);
  }
}

