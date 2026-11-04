import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, UserCheck, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, typography } from '../theme';
import GroupsStackNavigator from './GroupsStackNavigator';
import FriendsScreen from '../screens/FriendsScreen';
import AccountStackNavigator from './AccountStackNavigator';

const Tab = createBottomTabNavigator();

const MainNavigator = () => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Ensure the footer accounts for Android navigation buttons (3-button nav or gesture bar)
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);
  const tabHeight = 58 + bottomPadding;

  return (
    // @ts-ignore react-navigation v7 id prop
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        },
      }}
    >
      <Tab.Screen
        name="Groups"
        component={GroupsStackNavigator}
        options={{
          tabBarLabel: 'Groups',
          tabBarIcon: ({ color, size, focused }) => (
            <Users
              color={color}
              size={size - 2}
              strokeWidth={focused ? 2.4 : 1.8}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarIcon: ({ color, size, focused }) => (
            <UserCheck
              color={color}
              size={size - 2}
              strokeWidth={focused ? 2.4 : 1.8}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountStackNavigator}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size, focused }) => (
            <User
              color={color}
              size={size - 2}
              strokeWidth={focused ? 2.4 : 1.8}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
