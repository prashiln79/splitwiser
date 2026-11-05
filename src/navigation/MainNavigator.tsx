import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, UserCheck, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import GroupsStackNavigator from './GroupsStackNavigator';
import FriendsScreen from '../screens/FriendsScreen';
import AccountStackNavigator from './AccountStackNavigator';

const Tab = createBottomTabNavigator();

const MainNavigator = () => {
  const insets = useSafeAreaInsets();

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const tabHeight = 56 + bottomPadding;

  return (
    // @ts-ignore react-navigation v7 id prop
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            pressColor="transparent"
            android_ripple={{ color: 'transparent' }}
            pressOpacity={1}
          />
        ),
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8E8E8',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
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

import { StyleSheet } from 'react-native';

export default MainNavigator;
