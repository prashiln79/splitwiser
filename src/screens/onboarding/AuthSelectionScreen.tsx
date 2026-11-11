import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Mail,
  UserCheck,
  ChevronRight,
  X,
  Lock,
  User,
  ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme, ThemeColors, radii, shadows } from '../../theme';
import { GoogleIcon } from '../../components/common/GoogleIcon';
import { useGoogleAuth, GoogleAuthTokens } from '../../services/useGoogleAuth';

interface AuthSelectionScreenProps {
  navigation: any;
  route?: any;
}

export const AuthSelectionScreen: React.FC<AuthSelectionScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const {
    signInAsGuest,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth();

  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Email Modal State
  const initialMode = route?.params?.mode === 'login' ? 'login' : 'signup';
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailTab, setEmailTab] = useState<'signup' | 'login'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  // ─── 1. Guest Authentication ──────────────────────────────────────────────
  const handleStartAsGuest = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setIsGuestLoading(true);
    try {
      const guestProfile = await signInAsGuest();
      // If returning guest already has completed profile, go to Intro or Main
      if (guestProfile.hasCompletedProfile && guestProfile.name) {
        navigation.navigate('IntroSlides');
      } else {
        navigation.navigate('GuestProfileSetup');
      }
    } catch (err: any) {
      Alert.alert('Guest Access Notice', err.message || 'Could not start guest session.');
    } finally {
      setIsGuestLoading(false);
    }
  };

  // ─── 2. Google Authentication ─────────────────────────────────────────────
  const handleGoogleSuccess = async (tokens: GoogleAuthTokens) => {
    setIsGoogleLoading(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      const userProfile = await signInWithGoogle(
        tokens.idToken,
        tokens.accessToken,
        tokens.photoUrl,
        tokens.displayName,
        tokens.email
      );

      // If profile incomplete, complete it
      if (!userProfile.name || !userProfile.hasCompletedProfile) {
        navigation.navigate('GuestProfileSetup', {
          suggestedName: tokens.displayName || '',
          suggestedPhoto: tokens.photoUrl || undefined,
        });
      } else if (!userProfile.onboardingCompleted) {
        navigation.navigate('IntroSlides');
      }
      // If returning user with onboarding completed, AppNavigator handles immediate landing on MainNavigator!
    } catch (err: any) {
      console.error('[Google Auth] Error:', err);
      Alert.alert('Google Sign-In Failed', err.message || 'Could not authenticate with Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const { promptAsync } = useGoogleAuth(
    handleGoogleSuccess,
    (err) => {
      setIsGoogleLoading(false);
      Alert.alert('Authentication Error', err.message || 'Failed to authenticate with Google.');
    }
  );

  const handleGoogleSignIn = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        setIsGoogleLoading(false);
      }
    } catch (e: any) {
      setIsGoogleLoading(false);
      Alert.alert('Error', e.message || 'Failed to initiate Google sign-in.');
    }
  };

  // ─── 3. Email Authentication ──────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      Alert.alert('Incomplete Form', 'Please enter both your email address and password.');
      return;
    }

    // RFC 5321 compliant email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const localPart = trimmedEmail.split('@')[0];
    if (
      !emailRegex.test(trimmedEmail) ||
      localPart.startsWith('.') ||
      localPart.endsWith('.') ||
      localPart.includes('..')
    ) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (trimmedPass.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    setIsEmailSubmitting(true);
    try {
      if (emailTab === 'signup') {
        const profile = await signUpWithEmail(trimmedEmail, trimmedPass, name.trim());
        setEmailModalVisible(false);
        navigation.navigate('GuestProfileSetup', {
          suggestedName: name.trim(),
        });
      } else {
        const profile = await signInWithEmail(trimmedEmail, trimmedPass);
        setEmailModalVisible(false);
        if (!profile.name || !profile.hasCompletedProfile) {
          navigation.navigate('GuestProfileSetup');
        } else if (!profile.onboardingCompleted) {
          navigation.navigate('IntroSlides');
        }
      }
    } catch (err: any) {
      Alert.alert('Authentication Notice', err.message || 'Failed to authenticate with email.');
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Get Started</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Heading */}
        <View style={styles.headerBox}>
          <Text style={styles.title}>How would you like to continue?</Text>
          <Text style={styles.subtitle}>
            Choose how you want to start managing shared expenses.
          </Text>
        </View>

        {/* Options List (Guest primary, Google & Email clean secondary) */}
        <View style={styles.optionsList}>
          {/* Option 1: Start as Guest (Primary Highlighted Option) */}
          <TouchableOpacity
            style={[styles.authCard, styles.guestCard]}
            onPress={handleStartAsGuest}
            disabled={isGuestLoading || isGoogleLoading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Start as Guest"
          >
            <View style={styles.cardIconBoxGuest}>
              <UserCheck size={22} color={colors.primary} strokeWidth={2.3} />
            </View>

            <View style={styles.cardContent}>
              <View style={styles.titleBadgeRow}>
                <Text style={styles.cardTitle}>Start as Guest</Text>
                <View style={styles.instantBadge}>
                  <Text style={styles.instantBadgeText}>Instant Access</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                Use the complete app without creating an account.
              </Text>
            </View>

            {isGuestLoading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <ChevronRight size={20} color={colors.primary} strokeWidth={2.2} />
            )}
          </TouchableOpacity>

          {/* Option 2: Continue with Google */}
          <TouchableOpacity
            style={styles.authCard}
            onPress={handleGoogleSignIn}
            disabled={isGuestLoading || isGoogleLoading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <View style={styles.cardIconBox}>
              <GoogleIcon size={20} />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Continue with Google</Text>
              <Text style={styles.cardSubtitle}>
                Sync your account across devices.
              </Text>
            </View>

            {isGoogleLoading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {/* Option 3: Continue with Email */}
          <TouchableOpacity
            style={styles.authCard}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              setEmailModalVisible(true);
            }}
            disabled={isGuestLoading || isGoogleLoading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Continue with Email"
          >
            <View style={styles.cardIconBox}>
              <Mail size={20} color={colors.textPrimary} strokeWidth={2.2} />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Continue with Email</Text>
              <Text style={styles.cardSubtitle}>
                Sign up or log in with email.
              </Text>
            </View>

            <ChevronRight size={20} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Minimal Guest Assurance Line */}
        <View style={styles.reassuranceRow}>
          <ShieldCheck size={16} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.reassuranceText}>
            Your data stays safe when you link an account.
          </Text>
        </View>
      </ScrollView>

      {/* ─── Email Modal (Sign Up / Log In) ─────────────────────────────────── */}
      <Modal
        visible={emailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {emailTab === 'signup' ? 'Create Account' : 'Welcome Back'}
              </Text>
              <TouchableOpacity
                onPress={() => setEmailModalVisible(false)}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, emailTab === 'signup' && styles.tabItemActive]}
                onPress={() => setEmailTab('signup')}
              >
                <Text style={[styles.tabText, emailTab === 'signup' && styles.tabTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabItem, emailTab === 'login' && styles.tabItemActive]}
                onPress={() => setEmailTab('login')}
              >
                <Text style={[styles.tabText, emailTab === 'login' && styles.tabTextActive]}>
                  Log In
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {emailTab === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Your Name</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Alex Sharma"
                      placeholderTextColor={colors.textMuted}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputRow}>
                  <Mail size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputRow}>
                  <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleEmailSubmit}
                disabled={isEmailSubmitting}
                activeOpacity={0.85}
              >
                {isEmailSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {emailTab === 'signup' ? 'Create Account' : 'Log In'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0B132B' : '#F9FAFB',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    headerBox: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    optionsList: {
      gap: 14,
      marginBottom: 24,
    },
    authCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.xl,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 14,
      ...shadows.sm,
    },
    guestCard: {
      borderColor: isDark ? 'rgba(5, 150, 105, 0.5)' : '#10B981',
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.12)' : '#ECFDF5',
      borderWidth: 1.5,
    },
    cardIconBox: {
      width: 42,
      height: 42,
      borderRadius: radii.md,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardIconBoxGuest: {
      width: 42,
      height: 42,
      borderRadius: radii.md,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.22)' : '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: {
      flex: 1,
    },
    titleBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 3,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    instantBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    instantBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    cardSubtitle: {
      fontSize: 12.5,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    reassuranceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    reassuranceText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii['2xl'],
      borderTopRightRadius: radii['2xl'],
      paddingHorizontal: 24,
      paddingTop: 20,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: 6,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
      borderRadius: radii.lg,
      padding: 4,
      marginBottom: 20,
    },
    tabItem: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radii.md,
    },
    tabItemActive: {
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#F9FAFB',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 10,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.xl,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 12,
      ...shadows.md,
    },
    submitBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
