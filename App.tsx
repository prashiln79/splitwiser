import React from 'react';
import * as WebBrowser from 'expo-web-browser';
import { PaperProvider } from 'react-native-paper';

WebBrowser.maybeCompleteAuthSession();
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useAppTheme } from './src/theme';
import AppNavigator from './src/navigation/AppNavigator';

function MainApp() {
  const { paperTheme } = useAppTheme();
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
