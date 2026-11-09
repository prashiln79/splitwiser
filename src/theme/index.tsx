import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';
import { Theme as NavigationTheme, DefaultTheme as NavDefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import {
  AppearanceMode,
  ResolvedTheme,
  getStoredThemeMode,
  saveStoredThemeMode,
} from './themeStorage';
import {
  ThemeColors,
  lightColors,
  darkColors,
  typography,
  spacing,
  radii,
  shadows,
  resolveTheme,
} from './colors';
import { syncThemeToFirestore, fetchThemeFromFirestore } from '../services/themeService';

export type { AppearanceMode, ResolvedTheme, ThemeColors };
export {
  lightColors,
  darkColors,
  typography,
  spacing,
  radii,
  shadows,
  resolveTheme,
};

// Paper Theme Integration
export const getPaperTheme = (isDark: boolean): MD3Theme => {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  const colors = isDark ? darkColors : lightColors;

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      onPrimary: '#FFFFFF',
      primaryContainer: colors.primaryLight,
      onPrimaryContainer: colors.primaryDark,
      secondary: colors.secondary,
      background: colors.background,
      surface: colors.surface,
      surfaceVariant: colors.surfaceVariant,
      onSurface: colors.textPrimary,
      onSurfaceVariant: colors.textSecondary,
      outline: colors.border,
      error: colors.expense,
      backdrop: colors.backdrop,
    },
  };
};

// Navigation Theme Integration
export const getNavTheme = (isDark: boolean): NavigationTheme => {
  const colors = isDark ? darkColors : lightColors;
  return {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.expense,
    },
    fonts: NavDefaultTheme.fonts,
  };
};

// ─── Theme Context ─────────────────────────────────────────────────────────────

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  themeMode: AppearanceMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: AppearanceMode, uid?: string) => Promise<void>;
  toggleTheme: () => void;
  paperTheme: MD3Theme;
  navTheme: NavigationTheme;
  syncUserThemeOnLogin: (uid: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const osColorScheme = useColorScheme();
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(
    osColorScheme === 'dark' ? 'dark' : 'light'
  );
  const [themeMode, setThemeModeState] = useState<AppearanceMode>('system');

  // Load stored theme on initial mount
  useEffect(() => {
    let isMounted = true;
    getStoredThemeMode().then((saved) => {
      if (isMounted && saved) {
        setThemeModeState(saved);
      }
    });

    // Listen for OS appearance changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (isMounted) {
        setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  // Calculate resolved theme
  const resolvedTheme: ResolvedTheme = resolveTheme(themeMode, systemScheme);
  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const paperTheme = getPaperTheme(isDark);
  const navTheme = getNavTheme(isDark);

  const setThemeMode = useCallback(
    async (mode: AppearanceMode, uid?: string) => {
      setThemeModeState(mode);
      await saveStoredThemeMode(mode);
      if (uid) {
        syncThemeToFirestore(uid, mode).catch((err) =>
          console.warn('[ThemeProvider] Firestore theme sync error:', err)
        );
      }
    },
    []
  );

  const toggleTheme = useCallback(() => {
    const nextMode: AppearanceMode = isDark ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  const syncUserThemeOnLogin = useCallback(
    async (uid: string) => {
      if (!uid) return;
      try {
        const remoteMode = await fetchThemeFromFirestore(uid);
        if (remoteMode && (remoteMode === 'light' || remoteMode === 'dark' || remoteMode === 'system')) {
          setThemeModeState(remoteMode);
          await saveStoredThemeMode(remoteMode);
        }
      } catch (err) {
        console.warn('[ThemeProvider] Failed to sync user theme on login:', err);
      }
    },
    []
  );

  return (
    <ThemeContext.Provider
      value={{
        colors,
        isDark,
        themeMode,
        resolvedTheme,
        setThemeMode,
        toggleTheme,
        paperTheme,
        navTheme,
        syncUserThemeOnLogin,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return ctx;
};
