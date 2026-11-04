import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { MD3LightTheme, MD3DarkTheme, MD3Theme } from 'react-native-paper';
import { Theme as NavigationTheme, DefaultTheme as NavDefaultTheme, DarkTheme as NavDarkTheme } from '@react-navigation/native';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryGradient: [string, string];
  
  secondary: string;
  secondaryLight: string;
  
  background: string;
  surface: string;
  surfaceVariant: string;
  card: string;
  
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  
  border: string;
  borderLight: string;
  divider: string;
  
  income: string;
  incomeLight: string;
  incomeDark: string;
  
  expense: string;
  expenseLight: string;
  expenseDark: string;
  
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;
  
  badgeBackground: string;
  backdrop: string;
}

export const lightColors: ThemeColors = {
  primary: '#059669', // Emerald 600
  primaryLight: '#D1FAE5', // Emerald 100
  primaryDark: '#047857', // Emerald 700
  primaryGradient: ['#059669', '#10B981'],
  
  secondary: '#0284C7', // Sky 600
  secondaryLight: '#E0F2FE', // Sky 100
  
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9', // Slate 100
  card: '#FFFFFF',
  
  textPrimary: '#0F172A', // Slate 900
  textSecondary: '#475569', // Slate 600
  textMuted: '#94A3B8', // Slate 400
  textInverse: '#FFFFFF',
  
  border: '#E2E8F0', // Slate 200
  borderLight: '#F1F5F9', // Slate 100
  divider: '#E2E8F0',
  
  income: '#10B981', // Emerald 500
  incomeLight: '#ECFDF5', // Emerald 50
  incomeDark: '#065F46', // Emerald 800
  
  expense: '#EF4444', // Red 500
  expenseLight: '#FEF2F2', // Red 50
  expenseDark: '#991B1B', // Red 800
  
  warning: '#F59E0B', // Amber 500
  warningLight: '#FEF3C7', // Amber 100
  info: '#3B82F6', // Blue 500
  infoLight: '#EFF6FF', // Blue 50
  
  badgeBackground: '#F1F5F9',
  backdrop: 'rgba(15, 23, 42, 0.4)',
};

export const darkColors: ThemeColors = {
  primary: '#10B981', // Emerald 500
  primaryLight: '#064E3B', // Emerald 900
  primaryDark: '#34D399', // Emerald 400
  primaryGradient: ['#10B981', '#059669'],
  
  secondary: '#38BDF8', // Sky 400
  secondaryLight: '#0C4A6E', // Sky 900
  
  background: '#0B1120', // Very dark slate
  surface: '#151F32', // Dark slate surface
  surfaceVariant: '#1E293B', // Slate 800
  card: '#151F32',
  
  textPrimary: '#F8FAFC', // Slate 50
  textSecondary: '#CBD5E1', // Slate 300
  textMuted: '#64748B', // Slate 500
  textInverse: '#0F172A',
  
  border: '#243248',
  borderLight: '#1E293B',
  divider: '#243248',
  
  income: '#34D399', // Emerald 400
  incomeLight: '#064E3B',
  incomeDark: '#6EE7B7',
  
  expense: '#F87171', // Red 400
  expenseLight: '#7F1D1D',
  expenseDark: '#FCA5A5',
  
  warning: '#FBBF24',
  warningLight: '#78350F',
  info: '#60A5FA',
  infoLight: '#1E3A8A',
  
  badgeBackground: '#1E293B',
  backdrop: 'rgba(0, 0, 0, 0.7)',
};

export const typography = {
  fontFamilies: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 28,
    display: 34,
  },
  lineHeights: {
    xs: 15,
    sm: 18,
    base: 22,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 36,
    display: 42,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
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
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  themeMode: 'light' | 'dark' | 'system';
  paperTheme: MD3Theme;
  navTheme: NavigationTheme;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Theme is locked to light mode only
  const isDark = false;
  const colors = lightColors;
  const paperTheme = getPaperTheme(false);
  const navTheme = getNavTheme(false);

  const toggleTheme = () => {};
  const setThemeMode = () => {};

  return (
    <ThemeContext.Provider
      value={{
        colors,
        isDark: false,
        toggleTheme,
        setThemeMode,
        themeMode: 'light',
        paperTheme,
        navTheme,
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
