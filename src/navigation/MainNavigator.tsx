import React from 'react';
import { Platform, View, Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, User } from 'lucide-react-native';
import Svg, { Rect, Path, Circle, Defs, ClipPath } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';
import GroupsStackNavigator from './GroupsStackNavigator';
import FriendsStackNavigator from './FriendsStackNavigator';
import StatisticsScreen from '../screens/StatisticsScreen';
import AccountStackNavigator from './AccountStackNavigator';

const Tab = createBottomTabNavigator();

// ── Custom Activity/Statistics Icon matching Splitwise reference ──────────────
const StatisticsTabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Rect
      x="3"
      y="3.5"
      width="18"
      height="17"
      rx="3.5"
      stroke={color}
      strokeWidth={focused ? 2.4 : 1.9}
    />
    <Path
      d="M7 14.5L10 11.5L13.5 15L17 9.5"
      stroke={color}
      strokeWidth={focused ? 2.4 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ── Custom Splitwise Two-Tone Account Avatar Icon ─────────────────────────────
const AccountTabIcon = ({
  focused,
  photoURL,
}: {
  focused: boolean;
  photoURL?: string | null;
}) => {
  if (photoURL) {
    return (
      <View
        style={[
          styles.accountAvatarBox,
          focused && styles.accountAvatarBoxFocused,
        ]}
      >
        <Image source={{ uri: photoURL }} style={styles.accountAvatarImg} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.accountAvatarBox,
        focused && styles.accountAvatarBoxFocused,
      ]}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Defs>
          <ClipPath id="accClip">
            <Circle cx="12" cy="12" r="12" />
          </ClipPath>
        </Defs>
        <Circle cx="12" cy="12" r="12" fill="#A7F3D0" />
        <Path d="M0 24 L24 0 L24 24 Z" fill="#065F46" clipPath="url(#accClip)" />
      </Svg>
    </View>
  );
};

const MainNavigator = () => {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['groups', 'friends', 'charts', 'settings']);

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 56 + bottomPadding;

  return (
    // @ts-ignore react-navigation v7 id prop
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            pressColor="transparent"
            android_ripple={{ color: 'transparent' }}
            pressOpacity={1}
          />
        ),
        tabBarStyle: {
          backgroundColor: colors.tabBackground || colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
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
          tabBarLabel: t('groups:groups', { defaultValue: 'Groups' }),
          tabBarIcon: ({ color, focused }) => (
            <Users
              color={color}
              size={22}
              strokeWidth={focused ? 2.5 : 1.9}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsStackNavigator}
        options={{
          tabBarLabel: t('friends:friends', { defaultValue: 'Friends' }),
          tabBarIcon: ({ color, focused }) => (
            <User
              color={color}
              size={22}
              strokeWidth={focused ? 2.5 : 1.9}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Statistics"
        component={StatisticsScreen}
        options={{
          tabBarLabel: t('charts:statistics', { defaultValue: 'Statistics' }),
          tabBarIcon: ({ color, focused }) => (
            <StatisticsTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountStackNavigator}
        options={{
          tabBarLabel: t('settings:account', { defaultValue: 'Account' }),
          tabBarIcon: ({ focused }) => (
            <AccountTabIcon
              focused={focused}
              photoURL={user?.photoURL || user?.imageUrl}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  accountAvatarBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarBoxFocused: {
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  accountAvatarImg: {
    width: '100%',
    height: '100%',
  },
});

export default MainNavigator;
