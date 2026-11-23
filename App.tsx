import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StatusBar as RNStatusBar, Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
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

// ─── Global Error Boundary ────────────────────────────────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorBoundaryStyles.container}>
          <Text style={errorBoundaryStyles.title}>Something went wrong</Text>
          <Text style={errorBoundaryStyles.message}>{this.state.errorMessage}</Text>
          <TouchableOpacity style={errorBoundaryStyles.button} onPress={this.handleRetry}>
            <Text style={errorBoundaryStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#015c43',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

function MainApp() {
  const { paperTheme, isDark, colors } = useAppTheme();

  useEffect(() => {
    // Warm up SQLite tables & indexes on app launch.
    // On web, expo-sqlite uses OPFS (Origin Private File System) via
    // AccessHandlePoolVFS. The browser only allows ONE sync access handle per
    // file at a time, so opening a second tab throws:
    //   "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle':
    //    Access Handles cannot be created if there is another open Access Handle
    //    or Writable stream associated with the same file."
    // On web, all persistent data comes from Firestore directly — SQLite is
    // used only for native (iOS/Android) offline caching. Guard accordingly.
    if (Platform.OS !== 'web') {
      getDatabase().catch((e) => {
        console.warn('[App] SQLite init warning:', e);
      });
    }

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
    <AppErrorBoundary>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
    </AppErrorBoundary>
  );
}
