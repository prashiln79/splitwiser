import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';
import OnboardingScreen from '../screens/OnboardingScreen';
import MainNavigator from './MainNavigator';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import { InAppNotificationBanner } from '../components/notifications/InAppNotificationBanner';
import { attachNotificationResponseListener } from '../services/localNotificationService';

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const { navTheme } = useAppTheme();

  useEffect(() => {
    if (!isLoading) {
      // Dismiss the native splash screen smoothly once auth state and initial resources are ready
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Handle user tapping on native OS notifications
  useEffect(() => {
    const cleanup = attachNotificationResponseListener((data) => {
      if (navigationRef.isReady()) {
        if (data.groupId) {
          (navigationRef as any).navigate('GroupDetails', { groupId: data.groupId });
        } else {
          (navigationRef as any).navigate('NotificationCenter');
        }
      }
    });
    return cleanup;
  }, []);

  if (isLoading) {
    // Return null while loading so native splash screen stays visible without flicker
    return null;
  }

  return (
    <NavigationContainer theme={navTheme} ref={navigationRef}>
      <View style={{ flex: 1 }}>
        <InAppNotificationBanner navigationRef={navigationRef} />
        {user ? (
          // @ts-ignore react-navigation v7 id prop
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen
              name="NotificationCenter"
              component={NotificationCenterScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </Stack.Navigator>
        ) : (
          // @ts-ignore react-navigation v7 id prop
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </Stack.Navigator>
        )}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
