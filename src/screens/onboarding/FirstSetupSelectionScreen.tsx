import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Plane,
  Users,
  KeyRound,
  ArrowRight,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';

interface FirstSetupSelectionScreenProps {
  navigation: any;
}

interface SetupOption {
  id: string;
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  badge?: string;
  action: () => void;
}

export const FirstSetupSelectionScreen: React.FC<FirstSetupSelectionScreenProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { finishOnboarding } = useAuth();

  const handleSkip = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      await finishOnboarding();
      // AppNavigator will detect user.onboardingCompleted and route straight to MainNavigator
    } catch (e) {
      console.warn('[FirstSetup] Skip onboarding error:', e);
    }
  };

  const setupOptions: SetupOption[] = [
    {
      id: 'apartment',
      title: 'Add your apartment',
      description: 'Rent, utilities, groceries, and flatmate expenses',
      icon: Home,
      iconColor: '#3B82F6', // Blue
      badge: 'Popular',
      action: () => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        navigation.navigate('OnboardingGroupCreation', {
          initialType: 'home',
          suggestedName: 'Apartment',
        });
      },
    },
    {
      id: 'trip',
      title: 'Add a group trip',
      description: 'Flights, hotels, dinners, and road trip gas',
      icon: Plane,
      iconColor: '#F59E0B', // Amber
      action: () => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        navigation.navigate('OnboardingGroupCreation', {
          initialType: 'trip',
          suggestedName: 'Trip',
        });
      },
    },
    {
      id: 'friends',
      title: 'Create a group with friends',
      description: 'Parties, dinners, couple expenses, and regular outings',
      icon: Users,
      iconColor: '#10B981', // Emerald
      action: () => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        navigation.navigate('OnboardingGroupCreation', {
          initialType: 'other',
          suggestedName: 'Friends',
        });
      },
    },
    {
      id: 'join',
      title: 'Join an existing group',
      description: 'Have a 6-character code? Enter it to join right now',
      icon: KeyRound,
      iconColor: '#8B5CF6', // Purple
      action: () => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        navigation.navigate('JoinGroup', { isOnboarding: true });
      },
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step 2 of 2</Text>
        </View>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipTopButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Skip setup for now"
        >
          <Text style={styles.skipTopText}>Skip for now</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title & Subtitle */}
        <View style={styles.headerSection}>
          <View style={styles.headerIconRow}>
            <Sparkles size={20} color="#059669" strokeWidth={2.4} />
            <Text style={styles.headerSub}>GETTING STARTED</Text>
          </View>
          <Text style={styles.title}>What would you like to do first?</Text>
          <Text style={styles.subtitle}>
            Choose how you want to start. You can always create more groups or join friends later.
          </Text>
        </View>

        {/* Option Cards */}
        <View style={styles.optionsList}>
          {setupOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <TouchableOpacity
                key={opt.id}
                style={styles.card}
                onPress={opt.action}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel={opt.title}
              >
                <View style={[styles.cardIconBox, { backgroundColor: `${opt.iconColor}18` }]}>
                  <Icon size={24} color={opt.iconColor} strokeWidth={2.2} />
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{opt.title}</Text>
                    {opt.badge && (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgeText}>{opt.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>{opt.description}</Text>
                </View>

                <ArrowRight size={18} color="rgba(255, 255, 255, 0.4)" strokeWidth={2.2} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Skip CTA */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.skipTextButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip setup for now"
          >
            <Text style={styles.skipTextPrimary}>Skip setup for now</Text>
            <Text style={styles.skipTextSecondary}>
              I will explore the dashboard first
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#070D1F' : '#0B132B',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 12,
    },
    stepBadge: {
      backgroundColor: 'rgba(5, 150, 105, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(5, 150, 105, 0.3)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radii.full,
    },
    stepBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#34D399',
      letterSpacing: 0.3,
    },
    skipTopButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    skipTopText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.8)',
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    headerSection: {
      marginBottom: 28,
    },
    headerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    headerSub: {
      fontSize: 11,
      fontWeight: '800',
      color: '#34D399',
      letterSpacing: 1.2,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: 'rgba(255, 255, 255, 0.65)',
    },
    optionsList: {
      gap: 14,
      marginBottom: 32,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.05)',
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      padding: 18,
      ...shadows.sm,
    },
    cardIconBox: {
      width: 48,
      height: 48,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    cardInfo: {
      flex: 1,
      marginRight: 12,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    badgePill: {
      backgroundColor: 'rgba(5, 150, 105, 0.2)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: 'rgba(5, 150, 105, 0.4)',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#34D399',
      letterSpacing: 0.2,
    },
    cardDesc: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.6)',
      lineHeight: 18,
    },
    bottomSection: {
      alignItems: 'center',
      paddingTop: 8,
    },
    skipTextButton: {
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    skipTextPrimary: {
      fontSize: 15,
      fontWeight: '700',
      color: '#34D399',
      marginBottom: 3,
    },
    skipTextSecondary: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.5)',
    },
  });

