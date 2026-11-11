import React from 'react';
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
  Wallet,
  ArrowRight,
  Users,
  Scale,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';

interface WelcomeScreenProps {
  navigation: any;
}

const FEATURES = [
  {
    icon: Users,
    title: 'Share with anyone',
    description: 'Roommates, trips, dinners and daily bills.',
  },
  {
    icon: Scale,
    title: 'Fair expense splitting',
    description: 'Know who owes whom.',
  },
  {
    icon: Zap,
    title: 'Start instantly',
    description: 'No registration required with guest access.',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const handleGetStarted = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    navigation.navigate('AuthSelection', { mode: 'signup' });
  };

  const handleLogIn = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    navigation.navigate('AuthSelection', { mode: 'login' });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20) + 16,
            paddingBottom: Math.max(insets.bottom, 20) + 12,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top & Middle Section: Hero Emblem + Compact Feature Rows */}
        <View style={styles.topSection}>
          {/* Logo & Brand Identity */}
          <View style={styles.brandHero}>
            <View style={styles.logoHalo}>
              <View style={styles.logoCircle}>
                <Wallet size={28} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>

            <Text style={styles.brandTitle}>Splitwiser</Text>
            <Text style={styles.brandTagline}>Split expenses, stay friends.</Text>
          </View>

          {/* Compact Feature Rows (Clean icon + text, no bulky card boxes) */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <View key={index} style={styles.featureRow}>
                  <View style={styles.iconCircle}>
                    <IconComponent size={19} color={colors.primary} strokeWidth={2.3} />
                  </View>
                  <View style={styles.featureTextCol}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <Text style={styles.featureDesc}>{item.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Bottom Section: Primary Action CTA & Footer */}
        <View style={styles.bottomSection}>
          {/* Get Started Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <ArrowRight size={19} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Existing Account Log In Link */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogIn}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Log in to existing account"
          >
            <Text style={styles.loginButtonText}>
              Existing account? <Text style={styles.loginButtonHighlight}>Log In</Text>
            </Text>
          </TouchableOpacity>

          {/* Terms & Privacy Legal Notice */}
          <Text style={styles.legalNotice}>
            By continuing, you agree to Splitwiser's Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B132B' : '#F9FAFB',
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 28,
    },
    topSection: {
      alignItems: 'center',
    },
    brandHero: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 32,
    },
    logoHalo: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.16)' : '#ECFDF5',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.35)' : '#A7F3D0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    logoCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    brandTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#111827',
      letterSpacing: -0.6,
      marginBottom: 6,
    },
    brandTagline: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    featuresContainer: {
      width: '100%',
      maxWidth: 340,
      gap: 18,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.14)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTextCol: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1F2937',
      marginBottom: 2,
    },
    featureDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    bottomSection: {
      width: '100%',
      alignItems: 'center',
      paddingTop: 24,
    },
    primaryButton: {
      width: '100%',
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
      marginBottom: 14,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    loginButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    loginButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loginButtonHighlight: {
      color: colors.primary,
      fontWeight: '700',
    },
    legalNotice: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
      paddingHorizontal: 16,
    },
  });
