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
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';

interface WelcomeScreenProps {
  navigation: any;
}

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
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Emblem & Header */}
        <View style={styles.heroSection}>
          <View style={styles.logoOuterGlow}>
            <View style={styles.logoCircle}>
              <Wallet size={44} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </View>

          <Text style={styles.brandTitle}>Splitwiser</Text>
          <Text style={styles.brandTagline}>Split expenses, stay friends.</Text>

          {/* Quick Value Points */}
          <View style={styles.valuePointsContainer}>
            <View style={styles.valuePill}>
              <Users size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.valuePillText}>Roommates, trips, dinners & daily bills</Text>
            </View>

            <View style={styles.valuePill}>
              <Sparkles size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.valuePillText}>Smart debt minimization & fair splits</Text>
            </View>

            <View style={styles.valuePill}>
              <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
              <Text style={styles.valuePillText}>Start instantly as a guest • 100% Free</Text>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionSection}>
          {/* Get Started Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
            <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Log In Link */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogIn}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Log in to existing account"
          >
            <Text style={styles.loginButtonText}>
              I already have an account · <Text style={styles.loginButtonHighlight}>Log In</Text>
            </Text>
          </TouchableOpacity>

          {/* Legal Footnote */}
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
    heroSection: {
      alignItems: 'center',
      marginTop: 20,
    },
    logoOuterGlow: {
      width: 108,
      height: 108,
      borderRadius: 54,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.18)' : '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.4)' : '#A7F3D0',
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    brandTitle: {
      fontSize: 34,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#111827',
      letterSpacing: -0.8,
      marginBottom: 8,
    },
    brandTagline: {
      fontSize: 17,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
    valuePointsContainer: {
      width: '100%',
      gap: 12,
      maxWidth: 360,
    },
    valuePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 12,
      ...shadows.sm,
    },
    valuePillText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
      flex: 1,
    },
    actionSection: {
      width: '100%',
      alignItems: 'center',
      marginTop: 36,
    },
    primaryButton: {
      width: '100%',
      height: 56,
      backgroundColor: colors.primary,
      borderRadius: radii.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
      marginBottom: 16,
    },
    primaryButtonText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    loginButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
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
      paddingHorizontal: 12,
    },
  });

