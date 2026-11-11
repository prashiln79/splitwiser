import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StatusBar as RNStatusBar, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { I18nProvider } from './src/context/I18nContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ThemeProvider, useAppTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { getDatabase } from './src/db/sqlite';
import { initLocalNotifications } from './src/services/localNotificationService';
import { SecurityProvider } from './src/context/SecurityContext';
import { AppLockOverlay } from './src/components/security/AppLockOverlay';

// Keep the native splash screen visible while app initializes resources
SplashScreen.preventAutoHideAsync().catch(() => {});

function MainApp() {
  const { paperTheme, isDark, colors } = useAppTheme();

  useEffect(() => {
    // Warm up SQLite tables & indexes on app launch
    getDatabase().catch((e) => {
      console.warn('[App] SQLite init warning:', e);
    });

    // Initialize local Android/iOS notifications & channels
    initLocalNotifications().catch((e) => {
      console.warn('[App] Local notification setup notice:', e);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      (RNStatusBar as any).setBackgroundColor?.(colors.background, true);
    }
  }, [colors.background]);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      <AppLockOverlay />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            <NotificationProvider>
              <SecurityProvider>
                <MainApp />
              </SecurityProvider>
            </NotificationProvider>
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
