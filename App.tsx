import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';
import { getDatabase } from './src/db/sqlite';

// Keep the native splash screen visible while app initializes resources
SplashScreen.preventAutoHideAsync().catch(() => {});

function MainApp() {
  const { paperTheme } = useAppTheme();

  useEffect(() => {
    // Warm up SQLite tables & indexes on app launch
    getDatabase().catch((e) => {
      console.warn('[App] SQLite init warning:', e);
    });
  }, []);

  return (
    <PaperProvider theme={paperTheme}>
      <AppNavigator />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
