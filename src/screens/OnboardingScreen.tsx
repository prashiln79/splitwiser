import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Wallet,
  ArrowRight,
  Users,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, typography, spacing, radii, shadows } from '../theme';

const FEATURES = [
  {
    icon: Users,
    title: 'Split with Any Group',
    desc: 'Roommates, trips, dinners, or events.',
  },
  {
    icon: Sparkles,
    title: 'Smart Debt Minimization',
    desc: 'Fewer transactions to settle all debts.',
  },
  {
    icon: ShieldCheck,
    title: 'Instant Guest Access',
    desc: 'Get started immediately without friction.',
  },
];

const OnboardingScreen = () => {
  const { completeOnboarding } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }
    if (trimmed.length < 2) {
      Alert.alert('Name Too Short', 'Your name must be at least 2 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      await completeOnboarding(trimmed);
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      console.error('[Onboarding] Error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 24) + 16,
              paddingBottom: Math.max(insets.bottom + 24, 48),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Hero */}
          <View style={styles.brandContainer}>
            <View
              style={[
                styles.logoCircle,
                { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' },
              ]}
            >
              <Wallet size={40} color={colors.primary} strokeWidth={2.2} />
            </View>

            <Text style={[styles.appName, { color: colors.textPrimary }]}>
              Splitwiser
            </Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              Split expenses, stay friends.
            </Text>
          </View>

          {/* Value Propositions */}
          <View
            style={[
              styles.featuresCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            {FEATURES.map((item, index) => {
              const IconComp = item.icon;
              return (
                <View
                  key={item.title}
                  style={[
                    styles.featureRow,
                    index < FEATURES.length - 1 && [
                      styles.featureBorder,
                      { borderBottomColor: colors.borderLight },
                    ],
                  ]}
                >
                  <View style={[styles.featureIconBox, { backgroundColor: colors.primaryLight }]}>
                    <IconComp size={18} color={colors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.featureTextCol}>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      {item.desc}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Form */}
          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.sm,
            ]}
          >
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
              What should we call you?
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="e.g. Alex Sharma"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              accessibilityLabel="Enter your name"
            />

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor:
                    name.trim().length >= 2 ? colors.primary : colors.surfaceVariant,
                },
              ]}
              onPress={handleContinue}
              disabled={isSubmitting || name.trim().length < 2}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue to Splitwiser"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color:
                          name.trim().length >= 2 ? '#FFFFFF' : colors.textMuted,
                      },
                    ]}
                  >
                    Get Started
                  </Text>
                  <ArrowRight
                    size={18}
                    color={name.trim().length >= 2 ? '#FFFFFF' : colors.textMuted}
                    strokeWidth={2.4}
                    style={{ marginLeft: 6 }}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingTop: Platform.OS === 'ios' ? 72 : 48,
    paddingBottom: 48,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.sizes.sm,
    marginTop: 4,
  },
  featuresCard: {
    borderRadius: radii.xl,
    padding: spacing.base,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  featureBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  formCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  inputLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    fontWeight: '600',
    marginBottom: spacing.base,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.base,
    borderRadius: radii.xl,
  },
  buttonText: {
    fontSize: typography.sizes.base,
    fontWeight: '700',
  },
});

export default OnboardingScreen;
