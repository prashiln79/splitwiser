import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import { InAppNotificationBanner } from '../components/notifications/InAppNotificationBanner';
import { attachNotificationResponseListener } from '../services/localNotificationService';

export const navigationRef = createNavigationContainerRef();

const linking = {
  prefixes: ['splitwiser://', 'com.prashiln79.splitwiser://'],
  config: {
    screens: {
      Main: {
        screens: {
          Groups: {
            screens: {
              JoinGroup: 'join',
            },
          },
        },
      },
      Onboarding: {
        screens: {
          JoinGroup: 'join',
        },
      },
    },
  },
};

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const { navTheme, colors } = useAppTheme();
  const hasDismissedSplashRef = React.useRef(false);

  const dismissSplash = React.useCallback(() => {
    if (!hasDismissedSplashRef.current) {
      hasDismissedSplashRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Fallback timer ensures splash always dismisses even if onReady is delayed
      const timer = setTimeout(dismissSplash, 150);
      return () => clearTimeout(timer);
    }
  }, [isLoading, dismissSplash]);

  // Handle user tapping on native OS notifications
  useEffect(() => {
    const cleanup = attachNotificationResponseListener((data) => {
      if (navigationRef.isReady()) {
        if (data.groupId) {
          (navigationRef as any).navigate('Main', {
            screen: 'Groups',
            params: {
              screen: 'GroupDetails',
              params: { groupId: data.groupId },
            },
          });
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
    <NavigationContainer
      theme={navTheme}
      ref={navigationRef}
      linking={linking}
      onReady={dismissSplash}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <InAppNotificationBanner navigationRef={navigationRef} />
        {/* Single persistent Stack.Navigator to prevent FragmentManager transaction collision on native Android */}
        {/* @ts-ignore react-navigation v7 id prop */}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user && user.hasCompletedProfile && user.onboardingCompleted ? (
            <>
              <Stack.Screen name="Main" component={MainNavigator} />
              <Stack.Screen
                name="NotificationCenter"
                component={NotificationCenterScreen}
                options={{ animation: 'slide_from_right' }}
              />
            </>
          ) : (
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
          )}
        </Stack.Navigator>
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
